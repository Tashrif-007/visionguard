"""Measure dehaze_roi cost per ROI size (CPU, reference machine) and write src/perf.json."""
import json
import os
import time

import cv2

from backend.config import settings
from backend.models.tiny_cnn import load_tiny_cnn
from backend.services import pipeline
from backend.services.runtime_tuning import configure_cpu_threads

HERE = os.path.dirname(os.path.abspath(__file__))
configure_cpu_threads(settings.torch_num_threads, settings.cv_num_threads)
model = load_tiny_cnn(settings.model_path)
ok, frame = cv2.VideoCapture("uploads/foggy_street_tyumen_480p.webm").read()
assert ok, "hazy street clip not found"


def ms_per_call(roi, m, runs=40):
    for _ in range(3):
        pipeline.dehaze_roi(roi.copy(), model=m)
    start = time.perf_counter()
    for _ in range(runs):
        pipeline.dehaze_roi(roi.copy(), model=m)
    return (time.perf_counter() - start) / runs * 1000


results = []
for w, h in [(160, 120), (320, 240), (640, 360), (854, 480)]:
    roi = frame[:h, :w] if frame.shape[1] >= w and frame.shape[0] >= h else cv2.resize(frame, (w, h))
    results.append({"w": w, "h": h, "dcp": ms_per_call(roi, None), "cnn": ms_per_call(roi, model)})
    print(results[-1])
with open(os.path.join(HERE, "perf.json"), "w") as handle:
    json.dump(results, handle, indent=2)
