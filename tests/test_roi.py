import numpy as np

from backend.services.motion.roi import ROIBox, extract_roi


def _mask_with_blob(x: int, y: int, w: int, h: int, shape: tuple[int, int] = (240, 320)) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    mask[y : y + h, x : x + w] = 255
    return mask


def test_empty_mask_returns_none() -> None:
    mask = np.zeros((240, 320), dtype=np.uint8)
    assert extract_roi(mask, min_area=100, padding=10, frame_shape=(240, 320)) is None


def test_single_blob_bbox_with_padding() -> None:
    mask = _mask_with_blob(100, 80, 40, 30)
    box = extract_roi(mask, min_area=100, padding=10, frame_shape=(240, 320))
    assert box == ROIBox(x=90, y=70, width=60, height=50)


def test_blob_below_min_area_is_ignored() -> None:
    mask = _mask_with_blob(100, 80, 5, 5)
    assert extract_roi(mask, min_area=100, padding=10, frame_shape=(240, 320)) is None


def test_multiple_blobs_merge_into_one_box() -> None:
    mask = _mask_with_blob(20, 20, 30, 30)
    mask |= _mask_with_blob(200, 150, 40, 40)
    box = extract_roi(mask, min_area=100, padding=0, frame_shape=(240, 320))
    assert box == ROIBox(x=20, y=20, width=220, height=170)


def test_scattered_blobs_fall_back_to_largest_when_merge_exceeds_ratio() -> None:
    mask = _mask_with_blob(20, 20, 30, 30)
    mask |= _mask_with_blob(200, 150, 40, 40)
    # Merged box (220x170=37400px) exceeds 0.35 of the 240x320 frame (26880px);
    # the smaller blob is discarded and the larger one's box wins.
    box = extract_roi(mask, min_area=100, padding=0, frame_shape=(240, 320), max_area_ratio=0.35)
    assert box == ROIBox(x=200, y=150, width=40, height=40)


def test_nearby_blobs_still_merge_within_ratio() -> None:
    mask = _mask_with_blob(20, 20, 30, 30)
    mask |= _mask_with_blob(60, 30, 20, 20)
    box = extract_roi(mask, min_area=100, padding=0, frame_shape=(240, 320), max_area_ratio=0.35)
    assert box == ROIBox(x=20, y=20, width=60, height=30)


def test_padding_is_clamped_to_frame() -> None:
    mask = _mask_with_blob(0, 0, 30, 30)
    box = extract_roi(mask, min_area=100, padding=50, frame_shape=(240, 320))
    assert box is not None
    assert box.x == 0
    assert box.y == 0
    assert box.x + box.width <= 320
    assert box.y + box.height <= 240
