import cv2
import numpy as np

from backend.config import settings
from backend.models.tiny_cnn import TinyTransmissionCNN
from backend.services.dehazing.atmosphere import estimate_atmospheric_light
from backend.services.dehazing.dark_channel import compute_dark_channel
from backend.services.dehazing.gamma import apply_gamma
from backend.services.dehazing.guided_filter import guided_upsample
from backend.services.dehazing.radiance import recover_radiance
from backend.services.dehazing.refine import refine_transmission
from backend.services.dehazing.transmission import estimate_transmission


def _downscale(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    scale = max_side / max(height, width)
    if scale >= 1.0:
        return image
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return cv2.resize(image, size, interpolation=cv2.INTER_AREA)


def dehaze_roi(roi: np.ndarray, model: TinyTransmissionCNN | None = None) -> np.ndarray:
    """Run the full DCP dehazing pipeline on a BGR uint8 ROI.

    Frame → dark channel → atmospheric light (Top-K) → transmission →
    Tiny CNN refinement (skipped when no model is loaded) → guided upsample
    back to full ROI resolution → radiance recovery → gamma.

    The classical DCP stages run on a downscaled copy of the ROI (bounded by
    DEHAZE_MAX_SIDE) rather than at full, uncapped ROI resolution — this is
    the dominant per-frame cost on a large ROI, well above the tiny CNN's.
    The transmission map is then guided-upsampled (edge-aware, using the
    full-resolution grayscale ROI as the guide) instead of naively resized,
    which is what was smearing transmission across depth edges and causing
    DCP's characteristic halos. Radiance recovery and gamma still run at
    full ROI resolution so output sharpness is unaffected.

    Returns an enhanced BGR uint8 image of the same shape as roi.
    """
    image = roi.astype(np.float32) / 255.0
    small = _downscale(image, settings.dehaze_max_side)

    dark = compute_dark_channel(small, patch_size=settings.dcp_patch_size)
    atmospheric_light = estimate_atmospheric_light(
        small, dark, top_k_ratio=settings.atmo_top_k_ratio, min_pixels=settings.atmo_min_pixels
    )
    transmission = estimate_transmission(
        small,
        atmospheric_light,
        omega=settings.dehaze_omega,
        patch_size=settings.dcp_patch_size,
    )
    if model is not None:
        gray_small = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        transmission = refine_transmission(
            gray_small, dark, transmission, model, max_side=settings.refine_max_side
        )

    gray_full = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    transmission = guided_upsample(
        gray_full, transmission, radius=settings.guided_filter_radius, eps=settings.guided_filter_eps
    )

    radiance = recover_radiance(
        image, transmission, atmospheric_light, t_min=settings.dehaze_t_min
    )
    enhanced = apply_gamma(radiance, gamma=settings.dehaze_gamma)

    return (enhanced * 255.0).astype(np.uint8)
