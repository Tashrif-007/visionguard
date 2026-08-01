import numpy as np

from backend.services.dehazing.dark_channel import compute_dark_channel


def estimate_transmission(
    image: np.ndarray,
    atmospheric_light: np.ndarray,
    omega: float,
    patch_size: int,
) -> np.ndarray:
    """Initial transmission map t = 1 - omega * dark_channel(I / A).

    omega < 1 keeps a trace of haze for depth perception.
    Returns (H, W) float32 in [0, 1].
    """
    normalized = image / np.maximum(atmospheric_light, 1e-6)
    transmission = 1.0 - omega * compute_dark_channel(normalized.astype(np.float32), patch_size)
    return np.clip(transmission, 0.0, 1.0)
