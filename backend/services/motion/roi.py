from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class ROIBox:
    x: int
    y: int
    width: int
    height: int


def _merged_bbox(contours: list[np.ndarray]) -> tuple[int, int, int, int]:
    x_min = y_min = 10**9
    x_max = y_max = 0
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        x_min = min(x_min, x)
        y_min = min(y_min, y)
        x_max = max(x_max, x + w)
        y_max = max(y_max, y + h)
    return x_min, y_min, x_max, y_max


def _largest_bbox(contours: list[np.ndarray]) -> tuple[int, int, int, int]:
    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    return x, y, x + w, y + h


def extract_roi(
    mask: np.ndarray,
    min_area: int,
    padding: int,
    frame_shape: tuple[int, int],
    max_area_ratio: float = 1.0,
) -> ROIBox | None:
    """Merge significant contours in a binary mask into one padded bounding box.

    frame_shape is (height, width). Returns None when no contour reaches min_area.
    If the merged box would exceed max_area_ratio of the frame area (e.g.
    scattered motion in opposite corners ballooning the box toward full-frame),
    falls back to the single largest-area contour instead — this is what keeps
    "ROI-only" processing true rather than silently dehazing nearly the whole
    frame.
    """
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    significant = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not significant:
        return None

    height, width = frame_shape
    x_min, y_min, x_max, y_max = _merged_bbox(significant)

    if (x_max - x_min) * (y_max - y_min) > max_area_ratio * height * width:
        x_min, y_min, x_max, y_max = _largest_bbox(significant)

    x_min = max(0, x_min - padding)
    y_min = max(0, y_min - padding)
    x_max = min(width, x_max + padding)
    y_max = min(height, y_max + padding)

    return ROIBox(x=x_min, y=y_min, width=x_max - x_min, height=y_max - y_min)
