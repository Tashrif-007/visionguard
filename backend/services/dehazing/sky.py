import cv2
import numpy as np


def sky_weight(
    image: np.ndarray,
    min_value: float,
    max_saturation: float,
    search_fraction: float,
    blur_sigma: float,
) -> np.ndarray:
    """Soft mask of sky-like pixels: bright, unsaturated, connected to the top edge.

    image is (H, W, 3) float32 BGR in [0, 1]. Only the top search_fraction of
    the rows is searched, and a candidate region counts as sky only if it
    touches the first row, so bright walls or road glare lower in the frame
    are left alone. The mask is blurred so the transmission floor blends in
    without a visible seam. Returns (H, W) float32 in [0, 1].
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    candidate = ((hsv[..., 2] >= min_value) & (hsv[..., 1] <= max_saturation)).astype(np.uint8)
    candidate[int(image.shape[0] * search_fraction) :] = 0

    _, labels = cv2.connectedComponents(candidate)
    top_labels = np.unique(labels[0][labels[0] > 0])
    mask = np.isin(labels, top_labels).astype(np.float32)
    if blur_sigma > 0 and mask.any():
        mask = cv2.GaussianBlur(mask, (0, 0), blur_sigma)
    return mask


def apply_sky_floor(transmission: np.ndarray, weight: np.ndarray, floor: float) -> np.ndarray:
    """Raise the transmission to at least floor inside the sky mask.

    DCP assumes every pixel has a dark channel, which sky does not, so it
    reads sky as dense haze (low t). Radiance recovery then divides
    (I - A) by that low t and turns slightly-darker-than-A sky into dark
    blobs. A floor of 0 disables the correction.
    """
    return transmission + weight * (np.maximum(transmission, floor) - transmission)
