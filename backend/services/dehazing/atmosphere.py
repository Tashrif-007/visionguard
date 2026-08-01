import numpy as np


def estimate_atmospheric_light(
    image: np.ndarray,
    dark_channel: np.ndarray,
    top_k_ratio: float,
    min_pixels: int = 1,
) -> np.ndarray:
    """Average the image colors at the top-K brightest dark-channel pixels.

    Averaging over K pixels (rather than taking the single brightest one)
    keeps the estimate stable across frames and avoids flicker. min_pixels
    floors K so a small ROI doesn't collapse to the single-pixel case the
    Top-K design exists to avoid.
    Returns the atmospheric light as a float32 array of shape (3,).
    """
    flat_dark = dark_channel.ravel()
    num_pixels = int(np.clip(round(flat_dark.size * top_k_ratio), min(min_pixels, flat_dark.size), flat_dark.size))
    indices = np.argpartition(flat_dark, -num_pixels)[-num_pixels:]
    brightest = image.reshape(-1, 3)[indices]
    return brightest.mean(axis=0).astype(np.float32)
