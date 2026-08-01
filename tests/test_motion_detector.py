import numpy as np

from backend.services.motion.motion_detector import MotionDetector


def _static_frame() -> np.ndarray:
    frame = np.full((240, 320, 3), 60, dtype=np.uint8)
    frame[100:140, 100:140] = 200
    return frame


def test_static_scene_produces_no_foreground() -> None:
    detector = MotionDetector()
    frame = _static_frame()
    mask = detector.apply(frame)
    for _ in range(50):
        mask = detector.apply(frame)
    assert int(np.count_nonzero(mask)) == 0


def test_moving_object_produces_foreground() -> None:
    detector = MotionDetector()
    background = np.full((240, 320, 3), 60, dtype=np.uint8)
    for _ in range(50):
        detector.apply(background)

    moving = background.copy()
    moving[50:110, 200:260] = 255
    mask = detector.apply(moving)

    assert int(np.count_nonzero(mask[50:110, 200:260])) > 0


def test_mask_is_binary() -> None:
    detector = MotionDetector()
    background = np.full((240, 320, 3), 60, dtype=np.uint8)
    for _ in range(10):
        detector.apply(background)
    moving = background.copy()
    moving[20:80, 20:80] = 255
    mask = detector.apply(moving)

    assert set(np.unique(mask)).issubset({0, 255})
