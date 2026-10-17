from ultralytics import YOLO
import cv2
import math

# Initialize webcam
cap = cv2.VideoCapture(0)
cap.set(3, 640)
cap.set(4, 480)

# Load YOLO model
model = YOLO("models/yolov8n.pt")

classNames = ["person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck", "boat",
              "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
              "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
              "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat",
              "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
              "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
              "carrot", "hot dog", "pizza", "donut", "cake", "chair", "sofa", "pottedplant", "bed",
              "diningtable", "toilet", "tvmonitor", "laptop", "mouse", "remote", "keyboard", "cell phone",
              "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors",
              "teddy bear", "hair drier", "toothbrush"
              ]

prohibited_classes = ["cell phone", "laptop"]

# Initialize warning flag
cheating_detected = False

while True:
    success, img = cap.read()
    if not success:
        break
    
    results = model(img, stream=True)

    # Count the number of persons and detect prohibited devices
    person_count = 0
    detected_classes = []

    # Coordinates
    for r in results:
        boxes = r.boxes

        for box in boxes:
            # Bounding box
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)  # Convert to int values

            # Put box in cam
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 255), 3)

            # Confidence
            confidence = math.ceil((box.conf[0] * 100)) / 100

            # Class name
            cls = int(box.cls[0])
            class_name = classNames[cls]

            # Object details
            org = [x1, y1]
            font = cv2.FONT_HERSHEY_SIMPLEX
            fontScale = 1
            color = (255, 0, 0)
            thickness = 2

            cv2.putText(img, f"{class_name} {confidence}", org, font, fontScale, color, thickness)

            # Count persons and check for prohibited devices
            if class_name == "person":
                person_count += 1
            if class_name in prohibited_classes:
                detected_classes.append(class_name)

    # Generate warnings
    if person_count > 1:
        cheating_detected = True
        cv2.putText(img, "Warning: Multiple persons detected!", (50, 50), font, fontScale, (0, 0, 255), thickness)

    if detected_classes:
        cheating_detected = True
        warning_text = "Warning: Prohibited items detected! " + ", ".join(detected_classes)
        cv2.putText(img, warning_text, (50, 100), font, fontScale, (0, 0, 255), thickness)

    cv2.imshow('Webcam', img)
    if cv2.waitKey(1) == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
