import numpy as np

from backend.services.dehazing.sky import apply_sky_floor, sky_weight

PARAMS = dict(min_value=0.55, max_saturation=0.24, search_fraction=0.6, blur_sigma=0.0)


def _scene() -> np.ndarray:
    image = np.full((100, 100, 3), 0.2, np.float32)  # dark ground
    image[:40] = 0.8  # bright gray sky touching the top edge
    image[70:80, 10:30] = 0.9  # bright patch low in the frame, not connected to the top
    return image


def test_sky_mask_covers_top_region_only() -> None:
    weight = sky_weight(_scene(), **PARAMS)
    assert weight[:40].min() == 1.0
    assert weight[40:].max() == 0.0


def test_saturated_top_region_is_not_sky() -> None:
    image = _scene()
    image[:40] = (0.9, 0.3, 0.3)  # saturated blue
    assert sky_weight(image, **PARAMS).max() == 0.0


def test_floor_raises_transmission_only_inside_mask() -> None:
    transmission = np.full((100, 100), 0.2, np.float32)
    result = apply_sky_floor(transmission, sky_weight(_scene(), **PARAMS), floor=0.8)
    assert np.allclose(result[:40], 0.8)
    assert np.allclose(result[40:], 0.2)


def test_floor_never_lowers_transmission() -> None:
    transmission = np.full((10, 10), 0.95, np.float32)
    result = apply_sky_floor(transmission, np.ones((10, 10), np.float32), floor=0.8)
    assert np.allclose(result, 0.95)
