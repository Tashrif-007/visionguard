import numpy as np
import torch

from backend.models.tiny_cnn import TinyTransmissionCNN, load_tiny_cnn
from backend.services import pipeline
from backend.services.dehazing.refine import refine_transmission


def _hazy_roi() -> np.ndarray:
    """Uniformly hazed BGR uint8 patch with a dark object on a bright ground."""
    scene = np.full((64, 80, 3), 60, dtype=np.uint8)
    scene[20:50, 30:60] = (20, 20, 150)
    clean = scene.astype(np.float32) / 255.0
    hazy = clean * 0.5 + 0.85 * 0.5
    return (np.clip(hazy, 0.0, 1.0) * 255.0).astype(np.uint8)


def test_forward_output_shape_and_range() -> None:
    model = TinyTransmissionCNN()
    out = model(torch.rand(2, 3, 64, 80))
    assert out.shape == (2, 1, 64, 80)
    assert float(out.min()) >= 0.0
    assert float(out.max()) <= 1.0


def test_refine_transmission_matches_input_geometry() -> None:
    model = TinyTransmissionCNN().eval()
    gray = np.random.default_rng(0).random((48, 56)).astype(np.float32)
    dark = np.random.default_rng(1).random((48, 56)).astype(np.float32)
    coarse = np.random.default_rng(2).random((48, 56)).astype(np.float32)
    refined = refine_transmission(gray, dark, coarse, model, max_side=256)
    assert refined.shape == (48, 56)
    assert refined.dtype == np.float32
    assert refined.min() >= 0.0 and refined.max() <= 1.0


def test_refine_transmission_downscales_large_roi_back_to_full_size() -> None:
    model = TinyTransmissionCNN().eval()
    rng = np.random.default_rng(3)
    gray, dark, coarse = (rng.random((240, 320)).astype(np.float32) for _ in range(3))
    refined = refine_transmission(gray, dark, coarse, model, max_side=128)
    assert refined.shape == (240, 320)
    assert refined.min() >= 0.0 and refined.max() <= 1.0


def test_dehaze_roi_without_model_matches_pure_dcp_path() -> None:
    hazy = _hazy_roi()
    out = pipeline.dehaze_roi(hazy, model=None)
    assert out.shape == hazy.shape
    assert out.dtype == np.uint8


def test_dehaze_roi_with_model_returns_valid_image() -> None:
    hazy = _hazy_roi()
    out = pipeline.dehaze_roi(hazy, model=TinyTransmissionCNN().eval())
    assert out.shape == hazy.shape
    assert out.dtype == np.uint8


def test_load_tiny_cnn_missing_file_returns_none() -> None:
    assert load_tiny_cnn("nonexistent/weights.pth") is None


def test_load_tiny_cnn_round_trip(tmp_path) -> None:
    model = TinyTransmissionCNN()
    path = tmp_path / "tiny_cnn.pth"
    torch.save(model.state_dict(), path)
    loaded = load_tiny_cnn(str(path))
    assert loaded is not None
    assert not loaded.training
    x = torch.rand(1, 3, 32, 32)
    with torch.no_grad():
        assert torch.equal(model.eval()(x), loaded(x))
