import cv2
import numpy as np


def guided_filter(guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
    """Edge-aware smoothing of src under the structure of guide (He et al. 2010).

    Classical, closed-form filter — no learning involved. Used here to replace
    a naive bilinear upsample of the transmission map, which smears values
    across depth discontinuities and produces DCP's characteristic halos.
    guide and src are (H, W) float32 in [0, 1] of the same shape.
    """
    r = max(2, min(radius, min(guide.shape[:2]) // 4))
    ksize = (2 * r + 1, 2 * r + 1)

    mean_guide = cv2.boxFilter(guide, ddepth=-1, ksize=ksize)
    mean_src = cv2.boxFilter(src, ddepth=-1, ksize=ksize)
    corr_guide = cv2.boxFilter(guide * guide, ddepth=-1, ksize=ksize)
    corr_gs = cv2.boxFilter(guide * src, ddepth=-1, ksize=ksize)

    var_guide = corr_guide - mean_guide * mean_guide
    cov_gs = corr_gs - mean_guide * mean_src

    a = cov_gs / (var_guide + eps)
    b = mean_src - a * mean_guide

    mean_a = cv2.boxFilter(a, ddepth=-1, ksize=ksize)
    mean_b = cv2.boxFilter(b, ddepth=-1, ksize=ksize)

    q = mean_a * guide + mean_b
    return np.clip(q, 0.0, 1.0).astype(np.float32)


def guided_upsample(guide: np.ndarray, src: np.ndarray, radius: int, eps: float) -> np.ndarray:
    """Upsample src to guide's resolution, then guided-filter it against guide.

    guide is the full-resolution grayscale ROI; src is a lower-resolution
    transmission map (e.g. computed on a downscaled ROI for CPU budget).
    """
    height, width = guide.shape[:2]
    if src.shape[:2] != (height, width):
        src = cv2.resize(src, (width, height), interpolation=cv2.INTER_LINEAR)
    return guided_filter(guide, src, radius=radius, eps=eps)
