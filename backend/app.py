from flask import Flask
from flask_cors import CORS
from flask import request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from flask import jsonify
import os
from face_utils import extract_face, convert_image_to_vector, validate_student_face, to_pgvector


app = Flask(__name__)
CORS(app)
load_dotenv()

STUDENT_FOLDER = "uploads"
os.makedirs(STUDENT_FOLDER,exist_ok=True)

data_url = os.getenv("DATABASE_URL")
engine = create_engine(os.getenv("DATABASE_URL"))

# http://localhost:3000/register/student
@app.route('/register/student',methods=['POST'])
def register_student():
    data = request.get_json()
    name = data['name']
    email = data['email']
    phone_number = data['phone_number']
    department = data['department']
    passport_path = data['passport_path']

    face_extract = extract_face(passport_path)
    face_embedding = convert_image_to_vector(face_extract)
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO students
                (name, email, phone_number, department, face_embedding, passport_path)
                VALUES (:name, :email, :phone_number, :department, :face_embedding, :passport_path)
            """),
            {
                "name": name,
                "email": email,
                "phone_number": phone_number,
                "department": department,
                "face_embedding": to_pgvector(face_embedding),
                "passport_path": passport_path
            }
            )
            message = f'Student `{name}` was added succesfully'
            return jsonify({"message": message})
    except(Exception) as e:
        message = f'The error is {e}'
        return jsonify({"message": message})

# http://localhost:3000/mark_attendance
@app.route("/mark_attendance",methods=['POST'])
def mark_attendance():
    data = request.get_json()
    file_path = data['image']
    img = extract_face(file_path)
    embedding = convert_image_to_vector(img)
    result = validate_student_face(embedding)
    return jsonify({"message":str(result)})


if __name__ == "__main__":
    app.run(host='0.0.0.0',port=3000)