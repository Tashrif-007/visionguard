import numpy as np


def recover_radiance(
    image: np.ndarray,
    transmission: np.ndarray,
    atmospheric_light: np.ndarray,
    t_min: float,
) -> np.ndarray:
    """Invert the atmospheric scattering model: J = (I - A) / max(t, t_min) + A.

    t_min bounds the division to avoid amplifying noise where haze is dense.
    Returns float32 BGR in [0, 1].
    """
    t = np.maximum(transmission, t_min)[..., np.newaxis]
    radiance = (image - atmospheric_light) / t + atmospheric_light
    return np.clip(radiance, 0.0, 1.0).astype(np.float32)
