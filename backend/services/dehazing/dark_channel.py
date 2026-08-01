from functools import lru_cache

import cv2
import numpy as np


@lru_cache(maxsize=8)
def _rect_kernel(patch_size: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))


def compute_dark_channel(image: np.ndarray, patch_size: int) -> np.ndarray:
    """Dark channel prior: per-pixel channel minimum eroded over a patch.

    image is float32 BGR in [0, 1], shape (H, W, 3). Returns (H, W) in [0, 1].
    """
    min_channel = np.min(image, axis=2)
    return cv2.erode(min_channel, _rect_kernel(patch_size))
