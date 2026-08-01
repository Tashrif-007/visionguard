import numpy as np

from backend.services import pipeline


def _synthetic_scene() -> np.ndarray:
    """Clean BGR uint8 scene with structure: dark ground, bright sky, red object."""
    scene = np.zeros((120, 160, 3), dtype=np.uint8)
    scene[:60] = (180, 150, 120)
    scene[60:] = (40, 60, 50)
    scene[70:110, 60:100] = (30, 30, 200)
    return scene


def _add_haze(scene: np.ndarray, transmission: float, atmo: float = 0.85) -> np.ndarray:
    """Apply the scattering model I = J*t + A*(1-t) with uniform haze."""
    clean = scene.astype(np.float32) / 255.0
    hazy = clean * transmission + atmo * (1.0 - transmission)
    return (np.clip(hazy, 0.0, 1.0) * 255.0).astype(np.uint8)


def test_dehaze_preserves_shape_and_dtype() -> None:
    hazy = _add_haze(_synthetic_scene(), transmission=0.5)
    out = pipeline.dehaze_roi(hazy)
    assert out.shape == hazy.shape
    assert out.dtype == np.uint8


def test_dehaze_recovers_scene_closer_than_hazy_input() -> None:
    scene = _synthetic_scene().astype(np.float32)
    hazy = _add_haze(_synthetic_scene(), transmission=0.4)
    dehazed = pipeline.dehaze_roi(hazy).astype(np.float32)

    err_hazy = float(np.mean(np.abs(hazy.astype(np.float32) - scene)))
    err_dehazed = float(np.mean(np.abs(dehazed - scene)))
    assert err_dehazed < err_hazy


def test_dehaze_increases_contrast() -> None:
    hazy = _add_haze(_synthetic_scene(), transmission=0.4)
    dehazed = pipeline.dehaze_roi(hazy)
    assert float(dehazed.std()) > float(hazy.std())
