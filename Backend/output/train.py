import json, sys
from ultralytics import YOLO

YOLO("yolo11m.pt").train(**json.loads(sys.argv[1]))
