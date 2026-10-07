import cv2
import numpy as np
import torch

from backend.models.tiny_cnn import TinyTransmissionCNN


def refine_transmission(
    gray: np.ndarray,
    dark_channel: np.ndarray,
    transmission: np.ndarray,
    model: TinyTransmissionCNN,
    max_side: int,
) -> np.ndarray:
    """Refine the coarse DCP transmission map with the Tiny CNN.

    gray, dark_channel and transmission are (H, W) float32 in [0, 1].
    Large ROIs are refined at a capped resolution and upsampled back:
    transmission varies smoothly, so this preserves quality while keeping
    inference inside the per-frame CPU budget.
    Returns the refined (H, W) float32 transmission map in [0, 1].
    """
    height, width = transmission.shape
    scale = max_side / max(height, width)
    if scale < 1.0:
        small = (max(1, round(width * scale)), max(1, round(height * scale)))
        gray = cv2.resize(gray, small, interpolation=cv2.INTER_AREA)
        dark_channel = cv2.resize(dark_channel, small, interpolation=cv2.INTER_AREA)
        transmission = cv2.resize(transmission, small, interpolation=cv2.INTER_AREA)

    stacked = np.stack([gray, dark_channel, transmission], axis=0)
    batch = torch.from_numpy(stacked).unsqueeze(0)
    with torch.no_grad():
        refined = model(batch)
    result = refined.squeeze(0).squeeze(0).numpy().astype(np.float32)

    if scale < 1.0:
        result = cv2.resize(result, (width, height), interpolation=cv2.INTER_LINEAR)
    return result
