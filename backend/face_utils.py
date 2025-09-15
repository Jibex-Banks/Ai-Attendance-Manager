#  INSTALL THIS BEFORE RUNNING IF YOU ARE RUNNING FOR THE FIRST TIME
# pip install opencv-python imgbeddings psycopg2-binary

# Importing the necessary modules
import cv2
import numpy as np
from sentence_transformers import SentenceTransformer
from IPython.display import Image,display
import os

# Extracting the face and preprocessing from the image
def extract_face(passport_path):
  # loading haar algorithm into a variable in this case "alg"
  alg = "haarcascade_frontalface_default.xml"
  # pass the algorithm to Opencv
  haar_cascade = cv2.CascadeClassifier(alg)
  # for testing we would be using just one image but for the project we would get the image from the user
  # file_name = "romanreings.jpeg"
  file_name = passport_path
  # reading the image
  img = cv2.imread(file_name)
  # creating a black and white version of the image
  gray_image = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
  # detecting the face
  faces = haar_cascade.detectMultiScale(gray_image,1.05,minNeighbors=1,minSize=(150,150))
  # face detection
  if len(faces) == 0:
      raise ValueError("No face detected in the image. Please upload a clearer passport photo.")
  i = 0
  for x, y, w, h in faces:
    cropped_image = img[y: y + h, x : x + w]
    # adding the image/ face detected in a new folder
    target_file_name = f'detected_faces/{i}_{os.path.basename(passport_path)}'
    cv2.imwrite(target_file_name,cropped_image)
    i = i+1
  return target_file_name


def to_pgvector(embeddings):
  return '['+','.join(str(x) for x in embeddings.tolist())+']'

# Converting the preprocessed image/ regular image to vector
def convert_image_to_vector(image_path):
  from PIL import Image

  img = Image.open(image_path)
  model = SentenceTransformer("clip-ViT-B-32")
  # converts the image to embedding
  embeddings = model.encode(img,normalize_embeddings=True)

  return embeddings


# Checking for the students face in the database
def validate_student_face(embedding):
  from app import engine,text
  try:
    embedding_str = to_pgvector(embedding)
    with engine.begin() as conn:
      row = conn.execute(text("SELECT student_id, passport_path, face_embedding <=> (:embedding)::vector AS distance FROM students ORDER BY distance  LIMIT 1;"),{"embedding":embedding_str}).fetchone()
      if row is None or row.distance > 0.35:
        return "Match Not Found"
      return row[1]
  except(Exception) as e:
    return e