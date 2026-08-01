import cv2
import numpy as np

_DILATE_KERNEL = np.ones((5, 5), np.uint8)


class MotionDetector:
    """Background-subtraction motion detector producing a cleaned foreground mask."""

    def __init__(self, max_side: int = 480, history: int = 500, var_threshold: float = 16.0) -> None:
        self._max_side = max_side
        self._subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history, varThreshold=var_threshold, detectShadows=True
        )

    def apply(self, frame: np.ndarray) -> np.ndarray:
        """Return a full-frame-size binary foreground mask (0 or 255) for the given BGR frame.

        Runs MOG2 on a downscaled grayscale copy (cheaper per-frame cost that
        scales with total pixel count, paid on every frame regardless of
        whether motion is found), then resizes the mask back to full
        resolution so all downstream ROI code keeps working in full-frame
        pixel coordinates unchanged.
        """
        height, width = frame.shape[:2]
        scale = self._max_side / max(height, width)
        small = frame
        if scale < 1.0:
            size = (max(1, round(width * scale)), max(1, round(height * scale)))
            small = cv2.resize(frame, size, interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        mask = self._subtractor.apply(blurred)
        # MOG2 marks shadows as 127; keep only confident foreground.
        _, mask = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)
        mask = cv2.dilate(mask, _DILATE_KERNEL, iterations=2)

        if scale < 1.0:
            mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_NEAREST)
        return mask
