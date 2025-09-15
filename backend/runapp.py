# app.py
import os
import tempfile
import base64
import csv
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, stream_with_context, Response, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv
import numpy as np
from pgvector.sqlalchemy import Vector

# face utilities (your implementations)
from face_utils import extract_face, convert_image_to_vector, validate_student_face, to_pgvector

# load env
load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/attendancedb")
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

db = SQLAlchemy(app)

# ----------------------- MODELS -----------------------

class Faculty(db.Model):
    __tablename__ = "faculties"
    faculty_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True)
    phone_number = db.Column(db.Text)
    role = db.Column(db.Text)

class ClassModel(db.Model):
    __tablename__ = "classes"
    class_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    class_name = db.Column(db.Text, nullable=False)
    faculty_id = db.Column(db.BigInteger, db.ForeignKey("faculties.faculty_id"))
    schedule_start_time = db.Column(db.Time)
    schedule_end_time = db.Column(db.Time)

class Student(db.Model):
    __tablename__ = "students"
    student_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)
    phone_number = db.Column(db.Text)
    department = db.Column(db.Text)
    # pgvector column (512 dim). If your embeddings size differs, change the number.
    face_embedding = db.Column(Vector(512), nullable=False)
    passport_path = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Attendance(db.Model):
    __tablename__ = "attendance"
    attendance_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    student_id = db.Column(db.BigInteger, db.ForeignKey("students.student_id"), nullable=False)
    class_id = db.Column(db.BigInteger, db.ForeignKey("classes.class_id"))
    date = db.Column(db.Date, default=datetime.utcnow)
    in_time = db.Column(db.DateTime, default=datetime.utcnow)
    out_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.Text, nullable=False)

class Admin(db.Model):
    __tablename__ = "admin"
    admin_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    username = db.Column(db.Text, unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)

class Report(db.Model):
    __tablename__ = "reports"
    report_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    student_id = db.Column(db.BigInteger, db.ForeignKey("students.student_id"), nullable=False)
    attendance_percentage = db.Column(db.Numeric(5, 2))
    remarks = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)

# ----------------------- UTILITIES -----------------------

_attendance_event_queue = []

def publish_attendance_event(payload):
    _attendance_event_queue.append((time.time(), payload))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"}), 200

# ----------------------- STUDENT ENDPOINTS -----------------------

@app.route("/students", methods=["GET"])
def get_students():
    students = Student.query.order_by(Student.created_at.desc()).all()
    result = []
    for s in students:
        result.append({
            "student_id": s.student_id,
            "name": s.name,
            "email": s.email,
            "phone_number": s.phone_number,
            "department": s.department,
            "passport_path": s.passport_path,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return jsonify(result), 200

@app.route("/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    s = Student.query.get_or_404(student_id)
    return jsonify({
        "student_id": s.student_id,
        "name": s.name,
        "email": s.email,
        "phone_number": s.phone_number,
        "department": s.department,
        "passport_path": s.passport_path,
        "created_at": s.created_at.isoformat() if s.created_at else None
    }), 200

@app.route("/register/student", methods=["POST"])
def register_student():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error":"Invalid JSON"}), 400

    name = data.get("name")
    email = data.get("email")
    phone_number = data.get("phone_number")
    department = data.get("department", "")
    passport_path = data.get("passport_path")  # URL or data URL

    if not name or not email:
        return jsonify({"error":"name and email required"}), 400

    tmp_files = []
    try:
        image_path = None
        if passport_path and isinstance(passport_path, str) and passport_path.startswith("data:"):
            if len(passport_path) > (8 * 1024 * 1024):
                return jsonify({"error":"Image payload too large"}), 413
            try:
                header, encoded = passport_path.split(",", 1)
                decoded = base64.b64decode(encoded)
            except Exception as e:
                return jsonify({"error": f"Malformed or undecodable data URL: {str(e)}"}), 400

            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            tmp.write(decoded)
            tmp.flush()
            tmp.close()
            tmp_files.append(tmp.name)
            image_path = tmp.name
        else:
            image_path = passport_path

        if not image_path:
            return jsonify({"error":"No image provided"}), 400

        # face extraction
        try:
            face_file = extract_face(image_path)
        except Exception as e:
            return jsonify({"error": f"Face extraction failed: {str(e)}"}), 400

        # embedding
        try:
            embedding = convert_image_to_vector(face_file or image_path)
            if embedding is None:
                raise ValueError("Embedding returned None")
        except Exception as e:
            return jsonify({"error": f"Embedding failed: {str(e)}"}), 400

        # store student (embedding converted to list for pgvector compatibility)
        student = Student(
            name=name,
            email=email,
            phone_number=phone_number,
            department=department,
            face_embedding=embedding.tolist() if hasattr(embedding, "tolist") else list(embedding),
            passport_path=passport_path
        )
        db.session.add(student)
        db.session.commit()

        return jsonify({"message":f"Student {name} registered", "student_id": student.student_id}), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error":"A user with this email already exists."}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Server error: {str(e)}"}), 500
    finally:
        for f in tmp_files:
            try:
                os.unlink(f)
            except Exception:
                pass

# ----------------------- CLASSES / FACULTY -----------------------

@app.route("/classes", methods=["GET"])
def get_classes():
    classes = ClassModel.query.all()
    out = []
    for c in classes:
        out.append({
            "class_id": c.class_id,
            "class_name": c.class_name,
            "faculty_id": c.faculty_id,
            "schedule_start_time": c.schedule_start_time.isoformat() if c.schedule_start_time else None,
            "schedule_end_time": c.schedule_end_time.isoformat() if c.schedule_end_time else None
        })
    return jsonify(out), 200

@app.route("/classes", methods=["POST"])
def create_class():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400

    class_name = data.get("class_name")
    faculty_id = data.get("faculty_id")
    start = data.get("schedule_start_time")
    end = data.get("schedule_end_time")

    if not class_name:
        return jsonify({"error":"class_name required"}), 400

    c = ClassModel(class_name=class_name, faculty_id=faculty_id)
    # optional: parse times if provided (expect "HH:MM:SS" or "HH:MM")
    try:
        if start:
            from datetime import time as dtime
            h, m, *rest = [int(x) for x in start.split(":")]
            c.schedule_start_time = dtime(hour=h, minute=m, second=(int(rest[0]) if rest else 0))
        if end:
            from datetime import time as dtime
            h, m, *rest = [int(x) for x in end.split(":")]
            c.schedule_end_time = dtime(hour=h, minute=m, second=(int(rest[0]) if rest else 0))
    except Exception:
        pass

    db.session.add(c)
    db.session.commit()
    return jsonify({"message":"class created", "class_id": c.class_id}), 201

@app.route("/faculties", methods=["GET"])
def get_faculties():
    facs = Faculty.query.all()
    out = []
    for f in facs:
        out.append({
            "faculty_id": f.faculty_id,
            "name": f.name,
            "email": f.email,
            "phone_number": f.phone_number,
            "role": f.role
        })
    return jsonify(out), 200

@app.route("/faculties", methods=["POST"])
def create_faculty():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error":"Invalid JSON"}), 400

    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone_number")
    role = data.get("role", "")

    if not name:
        return jsonify({"error":"name required"}), 400

    f = Faculty(name=name, email=email, phone_number=phone, role=role)
    try:
        db.session.add(f)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error":"Faculty with this email exists"}), 409

    return jsonify({"message":"faculty created", "faculty_id": f.faculty_id}), 201

# ----------------------- ATTENDANCE (mark + get) -----------------------

@app.route("/attendance", methods=["GET"])
def get_attendance():
    records = Attendance.query.order_by(Attendance.date.desc(), Attendance.in_time.desc()).limit(1000).all()
    out = []
    for a in records:
        out.append({
            "attendance_id": a.attendance_id,
            "student_id": a.student_id,
            "class_id": a.class_id,
            "date": a.date.isoformat() if a.date else None,
            "in_time": a.in_time.isoformat() if a.in_time else None,
            "out_time": a.out_time.isoformat() if a.out_time else None,
            "status": a.status
        })
    return jsonify(out), 200

@app.route("/mark_attendance", methods=["POST"])
def mark_attendance():
    """
    Accepts JSON:
    { "image": "data:image/jpeg;base64,..." , "class_id": <int> }
    Returns match result and records attendance if match found.
    """
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error":"Invalid JSON"}), 400

    img = data.get("image")
    class_id = data.get("class_id")
    if not img:
        return jsonify({"error":"image required"}), 400

    tmp_files = []
    try:
        image_path = None
        if isinstance(img, str) and img.startswith("data:"):
            try:
                header, encoded = img.split(",", 1)
                decoded = base64.b64decode(encoded)
            except Exception as e:
                return jsonify({"error": f"Malformed or undecodable data URL: {str(e)}"}), 400
            tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            tmpf.write(decoded)
            tmpf.flush()
            tmpf.close()
            tmp_files.append(tmpf.name)
            image_path = tmpf.name
        else:
            image_path = img

        # compute embedding
        embedding = convert_image_to_vector(image_path)
        if embedding is None:
            return jsonify({"error":"Failed to compute embedding"}), 400

        emb_str = to_pgvector(embedding)  # string compatible with SQL casting
        row = None
        distance = None

        # Try vector operators in DB
        try:
            q = text("""
                SELECT student_id, passport_path,
                face_embedding <=> (:embedding)::vector AS distance
                FROM students
                ORDER BY distance
                LIMIT 1;
            """)
            row = db.session.execute(q, {"embedding": emb_str}).fetchone()
        except Exception:
            row = None

        if row is None:
            try:
                q2 = text("""
                    SELECT student_id, passport_path,
                    face_embedding <-> (:embedding)::vector AS distance
                    FROM students
                    ORDER BY distance
                    LIMIT 1;
                """)
                row = db.session.execute(q2, {"embedding": emb_str}).fetchone()
            except Exception:
                row = None

        if row is not None:
            try:
                # row may behave like mapping or tuple
                distance = row["distance"]
            except Exception:
                try:
                    distance = getattr(row, "distance", None)
                except Exception:
                    try:
                        distance = row[2]
                    except Exception:
                        distance = None

        match = None
        THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.35"))

        if row is not None and distance is not None and float(distance) <= THRESHOLD:
            try:
                passport_path = row["passport_path"]
            except Exception:
                passport_path = row[1]
            match = passport_path

        # Python fallback if DB didn't produce a match
        if match is None:
            students = Student.query.all()
            best = None
            best_dist = float("inf")
            for s in students:
                try:
                    db_emb = np.array(s.face_embedding, dtype=float)
                    dist = float(np.linalg.norm(db_emb - np.asarray(embedding, dtype=float)))
                    if dist < best_dist:
                        best_dist = dist
                        best = s
                except Exception:
                    continue
            if best is not None and best_dist <= THRESHOLD:
                match = best.passport_path

        if not match:
            return jsonify({"result":"Match Not Found"}), 200

        student = Student.query.filter_by(passport_path=match).first()
        if student is None:
            try:
                student_id = int(match)
                student = Student.query.get(student_id)
            except Exception:
                student = None

        if student is None:
            return jsonify({"error":"Matched student not found in DB"}), 500

        # create attendance record
        rec = Attendance(
            student_id=student.student_id,
            class_id=class_id,
            date=datetime.utcnow().date(),
            in_time=datetime.utcnow(),
            status="Present"
        )
        db.session.add(rec)
        db.session.commit()

        # publish event to SSE queue
        payload = {
            "attendance_id": rec.attendance_id,
            "student_id": rec.student_id,
            "class_id": rec.class_id,
            "in_time": rec.in_time.isoformat(),
            "status": rec.status
        }
        publish_attendance_event(payload)

        return jsonify({"result":"Matched", "student_id": student.student_id, "attendance_id": rec.attendance_id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Server error: {str(e)}"}), 500
    finally:
        for f in tmp_files:
            try:
                os.unlink(f)
            except Exception:
                pass

# ----------------------- REPORTS -----------------------

@app.route("/reports", methods=["GET"])
def get_reports():
    rep_rows = Report.query.order_by(Report.generated_at.desc()).all()
    out = []
    for r in rep_rows:
        out.append({
            "report_id": r.report_id,
            "student_id": r.student_id,
            "attendance_percentage": float(r.attendance_percentage) if r.attendance_percentage is not None else None,
            "remarks": r.remarks,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None
        })
    return jsonify(out), 200

@app.route("/reports/generate", methods=["POST"])
def generate_report():
    """
    Generate simple report for all students (attendance percentage over distinct attendance dates).
    """
    students = Student.query.all()
    # count distinct attendance dates
    total_days_query = db.session.query(Attendance.date).distinct().all()
    total_days = len(total_days_query) or 1
    new_reports = []
    for s in students:
        present_count = Attendance.query.filter_by(student_id=s.student_id, status="Present").count()
        perc = round((present_count / total_days) * 100, 2)
        remarks = "Good" if perc >= 75 else ("Average" if perc >= 50 else "Poor")
        rpt = Report(student_id=s.student_id, attendance_percentage=perc, remarks=remarks)
        db.session.add(rpt)
        new_reports.append({"student_id": s.student_id, "attendance_percentage": perc, "remarks": remarks})
    db.session.commit()
    return jsonify({"generated": new_reports}), 201

@app.route("/reports/export", methods=["GET"])
def export_reports_csv():
    reports = Report.query.order_by(Report.generated_at.desc()).all()
    if not reports:
        return jsonify({"error":"No reports to export"}), 404

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    try:
        with open(tmp.name, "w", newline="") as fh:
            writer = csv.writer(fh)
            writer.writerow(["report_id", "student_id", "attendance_percentage", "remarks", "generated_at"])
            for r in reports:
                writer.writerow([r.report_id, r.student_id, str(r.attendance_percentage), r.remarks, r.generated_at.isoformat() if r.generated_at else ""])
        return send_file(tmp.name, as_attachment=True, download_name="attendance_reports.csv", mimetype="text/csv")
    finally:
        # the file will be deleted by caller or OS; we don't delete immediately to allow send_file to read it
        pass

# ----------------------- SSE for attendance -----------------------

@app.route('/events/attendance')
def sse_attendance():
    def event_stream():
        last_index = 0
        while True:
            if last_index < len(_attendance_event_queue):
                # send new events
                for i in range(last_index, len(_attendance_event_queue)):
                    ts, payload = _attendance_event_queue[i]
                    yield f"data: {json.dumps(payload)}\n\n"
                last_index = len(_attendance_event_queue)
            time.sleep(0.5)
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

# ----------------------- ADMIN helpers (example) -----------------------

@app.route("/admin/create", methods=["POST"])
def create_admin():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error":"Invalid JSON"}), 400
    username = data.get("username")
    password_hash = data.get("password_hash")
    email = data.get("email")
    if not username or not password_hash or not email:
        return jsonify({"error":"username, password_hash and email required"}), 400
    a = Admin(username=username, password_hash=password_hash, email=email)
    try:
        db.session.add(a)
        db.session.commit()
        return jsonify({"message":"admin created", "admin_id": a.admin_id}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error":"admin with this username/email exists"}), 409

# ----------------------- DB init helper (cli) -----------------------

@app.cli.command("init-db")
def init_db():
    """Create all tables. Make sure pgvector extension is installed in DB."""
    db.create_all()
    print("DB initialized")

# ----------------------- RUN -----------------------

if __name__ == "__main__":
    # For development only; in production use Gunicorn/other WSGI server
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 3000)), debug=True)
