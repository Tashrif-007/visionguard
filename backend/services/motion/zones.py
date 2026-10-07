import cv2
import numpy as np

from backend.services.camera_config import Zone

INCLUDE = "include"
EXCLUDE = "exclude"


def build_zone_mask(frame_shape: tuple[int, int], zones: tuple[Zone, ...]) -> np.ndarray | None:
    """Rasterise zones into a 0/255 mask the size of the frame.

    Returns None when there are no zones (nothing to restrict). If any include
    zone exists, only the union of include zones is active; exclude zones are
    then subtracted. With only exclude zones, the whole frame is active minus
    those zones.
    """
    if not zones:
        return None

    height, width = frame_shape
    includes = [z for z in zones if z.mode == INCLUDE]
    mask = np.zeros((height, width), np.uint8) if includes else np.full((height, width), 255, np.uint8)

    for zone in includes:
        cv2.fillPoly(mask, [_to_pixels(zone, width, height)], 255)
    for zone in zones:
        if zone.mode == EXCLUDE:
            cv2.fillPoly(mask, [_to_pixels(zone, width, height)], 0)
    return mask


def _to_pixels(zone: Zone, width: int, height: int) -> np.ndarray:
    pts = np.array(zone.points, dtype=np.float32) * np.array([width - 1, height - 1], dtype=np.float32)
    return np.round(pts).astype(np.int32).reshape(-1, 1, 2)
