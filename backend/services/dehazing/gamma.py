import numpy as np


def apply_gamma(image: np.ndarray, gamma: float) -> np.ndarray:
    """Gamma correction: out = image ** gamma. gamma < 1 brightens.

    image is float32 in [0, 1]; dehazed frames skew dark, so the default
    gamma from config is below 1.
    """
    return np.power(np.clip(image, 0.0, 1.0), gamma).astype(np.float32)
