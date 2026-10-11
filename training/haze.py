"""Uneven haze for training: real haze thickness varies across a scene.

Both outdoor datasets give a clean frame and a transmission map that follows
depth only, which renders perfectly uniform haze. Raising t to a smooth random
power field (t ** field, field in FIELD_RANGE) thickens the haze in some
patches and thins it in others, as patchy fog does, while keeping t in (0, 1].
"""

import cv2
import numpy as np

FIELD_RANGE = (0.6, 1.5)
FIELD_CELLS = 4  # coarse grid the field is upsampled from, per patch side


def patchy_transmission(t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Return t ** field for a smooth random field over the (H, W) patch."""
    height, width = t.shape
    coarse = rng.uniform(*FIELD_RANGE, size=(FIELD_CELLS, FIELD_CELLS)).astype(np.float32)
    field = cv2.resize(coarse, (width, height), interpolation=cv2.INTER_CUBIC)
    field = np.clip(field, *FIELD_RANGE)
    return np.power(t, field).astype(np.float32)
