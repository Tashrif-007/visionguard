import numpy as np

from backend.services.dehazing.dark_channel import compute_dark_channel


def test_black_image_has_zero_dark_channel() -> None:
    image = np.zeros((60, 80, 3), dtype=np.float32)
    dark = compute_dark_channel(image, patch_size=15)
    assert dark.shape == (60, 80)
    assert float(dark.max()) == 0.0


def test_white_image_has_full_dark_channel() -> None:
    image = np.ones((60, 80, 3), dtype=np.float32)
    dark = compute_dark_channel(image, patch_size=15)
    assert float(dark.min()) == 1.0


def test_dark_channel_never_exceeds_channel_minimum() -> None:
    rng = np.random.default_rng(42)
    image = rng.random((60, 80, 3), dtype=np.float32)
    dark = compute_dark_channel(image, patch_size=15)
    assert np.all(dark <= np.min(image, axis=2) + 1e-6)


def test_saturated_colors_have_low_dark_channel() -> None:
    # A pure-red image has zero G and B, so its dark channel is zero.
    image = np.zeros((60, 80, 3), dtype=np.float32)
    image[:, :, 2] = 1.0
    dark = compute_dark_channel(image, patch_size=15)
    assert float(dark.max()) == 0.0


def test_dark_pixel_spreads_over_patch() -> None:
    image = np.ones((61, 61, 3), dtype=np.float32)
    image[30, 30] = 0.0
    dark = compute_dark_channel(image, patch_size=15)
    # Erosion propagates the dark pixel across the surrounding patch.
    assert float(dark[30, 37]) == 0.0
    assert float(dark[30, 45]) == 1.0
