#  INSTALL THIS BEFORE RUNNING IF YOU ARE RUNNING FOR THE FIRST TIME
# pip install opencv-python imgbeddings psycopg2-binary

import cv2
import numpy as np
from sentence_transformers import SentenceTransformer
from IPython.display import Image, display
import os

# Extracting the face and preprocessing from the image
def extract_face(passport_path):
    # load Haar cascade properly
    haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    haar_cascade = cv2.CascadeClassifier(haar_path)

    if haar_cascade.empty():
        raise RuntimeError("Failed to load Haarcascade. Please check your OpenCV installation.")

    # read the image
    img = cv2.imread(passport_path)
    if img is None:
        raise ValueError(f"Could not read image from path: {passport_path}")

    # convert to grayscale
    gray_image = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # detect faces
    faces = haar_cascade.detectMultiScale(gray_image, 1.05, minNeighbors=3, minSize=(150, 150))

    if len(faces) == 0:
        raise ValueError("No face detected in the image. Please upload a clearer passport photo.")

    os.makedirs("detected_faces", exist_ok=True)  # ensure folder exists

    i = 0
    for x, y, w, h in faces:
        cropped_image = img[y:y+h, x:x+w]
        target_file_name = f'detected_faces/{i}_{os.path.basename(passport_path)}'
        cv2.imwrite(target_file_name, cropped_image)
        i += 1

    return target_file_name


def to_pgvector(embeddings):
    return '[' + ','.join(str(x) for x in embeddings.tolist()) + ']'


def convert_image_to_vector(image_path):
    from PIL import Image
    img = Image.open(image_path)
    model = SentenceTransformer("clip-ViT-B-32")
    embeddings = model.encode(img, normalize_embeddings=True)
    return embeddings


def validate_student_face(embedding):
    from app_test import engine, text
    try:
        embedding_str = to_pgvector(embedding)
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT student_id, passport_path, face_embedding <=> (:embedding)::vector AS distance "
                    "FROM students ORDER BY distance LIMIT 1;"
                ),
                {"embedding": embedding_str}
            ).fetchone()

            if row is None or row.distance > 0.35:
                return "Match Not Found"
            return row[1]
    except Exception as e:
        return e
