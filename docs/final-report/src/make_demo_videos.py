"""Create the demo videos used for the screenshots (written to logs/, which is git-ignored)."""
import os

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "logs"))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
os.makedirs(OUT, exist_ok=True)

# 1) a looped real hazy street clip (forward then backward) of about 3 minutes
cap = cv2.VideoCapture(os.path.join(REPO, "uploads", "foggy_street_tyumen_480p.webm"))
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
w = cv2.VideoWriter(os.path.join(OUT, "tyumen_loop.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), 30, (frames[0].shape[1], frames[0].shape[0]))
n = 0
while n < 5400:
    for f in frames + frames[::-1]:
        w.write(f)
        n += 1
w.release()

# 2) a synthetic clip: a white rectangle moving over noise, plus an intermittent red disc
w = cv2.VideoWriter(os.path.join(OUT, "long.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), 30, (640, 360))
rng = np.random.default_rng(0)
bg = (rng.random((360, 640, 3)) * 40 + 100).astype(np.uint8)
for i in range(6000):
    f = bg.copy()
    x = 420 + int(80 * np.sin(i / 15))
    cv2.rectangle(f, (x, 120), (x + 60, 200), (255, 255, 255), -1)
    if (i // 150) % 2 == 0:
        cv2.circle(f, (120 + int(60 * np.cos(i / 20)), 250), 25, (40, 40, 200), -1)
    w.write(f)
w.release()
print("videos written to", OUT)
