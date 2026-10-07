import numpy as np

from backend.services.dehazing.atmosphere import estimate_atmospheric_light
from backend.services.dehazing.dark_channel import compute_dark_channel
from backend.services.dehazing.transmission import estimate_transmission

ATMO = np.array([0.8, 0.8, 0.8], dtype=np.float32)


def test_haze_free_region_has_high_transmission() -> None:
    # Pure red: dark channel of I/A is 0, so t = 1.
    image = np.zeros((60, 80, 3), dtype=np.float32)
    image[:, :, 2] = 1.0
    t = estimate_transmission(image, ATMO, omega=0.95, patch_size=15)
    assert float(t.min()) >= 0.99


def test_fully_hazy_region_has_low_transmission() -> None:
    # Image equal to atmospheric light everywhere: t = 1 - omega.
    image = np.tile(ATMO, (60, 80, 1)).astype(np.float32)
    t = estimate_transmission(image, ATMO, omega=0.95, patch_size=15)
    assert np.allclose(t, 1.0 - 0.95, atol=1e-4)


def test_transmission_is_clipped_to_unit_range() -> None:
    rng = np.random.default_rng(7)
    image = rng.random((60, 80, 3), dtype=np.float32)
    t = estimate_transmission(image, ATMO, omega=0.95, patch_size=15)
    assert float(t.min()) >= 0.0
    assert float(t.max()) <= 1.0


def test_atmospheric_light_uses_topk_average() -> None:
    # Haze in one corner should dominate the estimate via the dark channel.
    image = np.full((100, 100, 3), 0.2, dtype=np.float32)
    image[:20, :20] = 0.9
    dark = compute_dark_channel(image, patch_size=15)
    atmo = estimate_atmospheric_light(image, dark, top_k_ratio=0.001)
    assert atmo.shape == (3,)
    assert np.allclose(atmo, 0.9, atol=1e-3)
