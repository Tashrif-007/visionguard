"""Trim white margins (and the old embedded 'FigN:' caption line) from the earlier use-case/activity diagrams."""
import glob
import os

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.abspath(os.path.join(HERE, "..", "assets", "trim"))
os.makedirs(OUT, exist_ok=True)

sources = glob.glob(os.path.join(DOCS, "diagrams", "use-case", "*.png")) + glob.glob(os.path.join(DOCS, "diagrams", "activity", "*.png"))
gantt = os.path.abspath(os.path.join(DOCS, "..", "visionguard_gantt_chart.png"))
if os.path.exists(gantt):
    sources.append(gantt)

for path in sources:
    img = cv2.imread(path)
    ys, xs = np.where(img.min(axis=2) < 235)
    pad = 14
    y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
    out = img[y0:y1, x0:x1]
    if "gantt" not in path:
        ink = (out.min(axis=2) < 200).any(axis=1)
        y = len(ink) - 1
        while y > 0 and not ink[y]:
            y -= 1
        top = y
        while top > 0 and ink[top]:
            top -= 1
        gap_end, gap = top, 0
        while gap_end > 0 and not ink[gap_end]:
            gap_end -= 1
            gap += 1
        if y - top <= 22 and gap >= 4:  # a single short caption line at the bottom
            out = out[: gap_end + 8]
    cv2.imwrite(os.path.join(OUT, os.path.basename(path)), out)
    print(os.path.basename(path), out.shape[:2])
