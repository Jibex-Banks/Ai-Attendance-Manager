import os
import tempfile
import base64
import csv
import json
import time
from datetime import datetime, time as dtime
from flask import Flask, request, jsonify, stream_with_context, Response, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import JSONB
from dotenv import load_dotenv
from face_utils import extract_face, convert_image_to_vector, validate_student_face, to_pgvector

# load env
load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/attendancedb")
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# MODELS
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
    # store embeddings as JSON list for SQLAlchemy portability
    face_embedding = db.Column(JSONB, nullable=False)
    passport_path = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Attendance(db.Model):
    __tablename__ = "attendance"
    attendance_id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    student_id = db.Column(db.BigInteger, db.ForeignKey("students.student_id"), nullable=False)
    class_id = db.Column(db.BigInteger, db.ForeignKey("classes.class_id"))
    date = db.Column(db.Date, default=datetime.now)
    in_time = db.Column(db.DateTime, default=datetime.now)
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
    attendance_percentage = db.Column(db.Numeric(5,2))
    remarks = db.Column(db.Text)
    generated_at = db.Column(db.DateTime, default=datetime.now)

# Helper: simple publisher for SSE (in-memory)
_attendance_event_queue = []

def publish_attendance_event(payload):
    _attendance_event_queue.append((time.time(), payload))

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"}), 200

# CRUD Endpoints
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
            "created_at": s.created_at.isoformat()
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
        "created_at": s.created_at.isoformat()
    }), 200

@app.route("/register/student", methods=["POST"])
def register_student():
    data = request.get_json(force=True)
    name = data.get("name")
    email = data.get("email")
    phone_number = data.get("phone_number")
    department = data.get("department", "")
    passport_path = data.get("passport_path")  # could be URL or base64; we accept both

    if not name or not email:
        return jsonify({"error":"name and email required"}), 400

    # Accept base64 image or URL/path
    image_path = None
    if passport_path and passport_path.startswith("data:"):
        # base64 payload — decode to temp file
        header, encoded = passport_path.split(",", 1)
        ext = "jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
        tmp.write(base64.b64decode(encoded))
        tmp.flush()
        tmp.close()
        image_path = tmp.name
    else:
        image_path = passport_path

    # Extract face and embedding
    try:
        face_file = extract_face(image_path) if image_path else None
        embedding = convert_image_to_vector(face_file or image_path)
    except Exception as e:
        return jsonify({"error": f"Face extraction/embedding failed: {str(e)}"}), 400

    student = Student(
        name=name,
        email=email,
        phone_number=phone_number,
        department=department,
        face_embedding=list(embedding.tolist()) if hasattr(embedding, "tolist") else embedding,
        passport_path=passport_path
    )
    db.session.add(student)
    db.session.commit()

    return jsonify({"message":f"Student {name} registered", "student_id": student.student_id}), 201

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
    data = request.get_json(force=True)
    img = data.get("image")
    class_id = data.get("class_id")
    if not img:
        return jsonify({"error":"image required"}), 400

    # Decode image to temp file
    try:
        header, encoded = img.split(",", 1) if img.startswith("data:") else (None, None)
        if encoded:
            tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            tmpf.write(base64.b64decode(encoded))
            tmpf.flush()
            tmpf.close()
            image_path = tmpf.name
        else:
            image_path = img  # maybe server-side path sent
    except Exception as e:
        return jsonify({"error": f"Failed to decode image: {str(e)}"}), 400

    # Convert to embedding
    try:
        embedding = convert_image_to_vector(image_path)
    except Exception as e:
        return jsonify({"error": f"Embedding failed: {str(e)}"}), 400

    try:
        # Use your validate_student_face which returns passport_path if matched or 'Match Not Found'
        match = validate_student_face(embedding)
    except Exception as e:
        return jsonify({"error": f"Matching failed: {str(e)}"}), 500

    if not match or match == "Match Not Found":
        return jsonify({"result":"Match Not Found"}), 200

    # match is the passport_path or student identifier from validate_student_face
    # If validate_student_face returns the passport_path, query the student
    student = Student.query.filter_by(passport_path=match).first()
    if student is None:
        # fallback: if validate returned student_id or path
        try:
            student_id = int(match)
            student = Student.query.get(student_id)
        except:
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

# Reports endpoints
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
            "generated_at": r.generated_at.isoformat()
        })
    return jsonify(out), 200

@app.route("/reports/generate", methods=["POST"])
def generate_report():
    """
    Generate simple report for all students (attendance percentage over available attendance).
    """
    students = Student.query.all()
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
    writer = csv.writer(open(tmp.name, "w", newline=""))
    writer.writerow(["report_id", "student_id", "attendance_percentage", "remarks", "generated_at"])
    for r in reports:
        writer.writerow([r.report_id, r.student_id, str(r.attendance_percentage), r.remarks, r.generated_at.isoformat()])

    return send_file(tmp.name, as_attachment=True, download_name="attendance_reports.csv", mimetype="text/csv")

# SSE for attendance
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

# helper to create tables
@app.cli.command("init-db")
def init_db():
    db.create_all()
    print("DB initialized")

if __name__ == "__main__":
    # For development only
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 3000)), debug=True)