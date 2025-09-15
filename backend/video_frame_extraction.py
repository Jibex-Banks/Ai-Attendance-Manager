import cv2
import os

vid = cv2.VideoCapture(r"C:\Users\Mudathir\Videos\Beginning python with Mosh .mp4")
currentframe = 0

if not os.path.exists('data'):
    os.makedirs('data')

while(True):
    sucess, frame = vid.read()

    cv2.imshow("Output", frame)
    cv2.imwrite('./data/frame'+ str(currentframe) + '.jpg', frame)
    currentframe +=1

    if cv2.waitKey(1) & 0xFF == ord('q') or currentframe == 10:
        break

vid.release()