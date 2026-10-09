import time

import cv2
import numpy as np

from backend.services.camera_config import CameraStatus
from backend.services.capture_service import BROWSER_SOURCE_PREFIX, CaptureManager, PushFrameReader


def _jpeg(width: int, height: int, value: int = 120) -> bytes:
    frame = np.full((height, width, 3), value, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", frame)
    assert ok
    return encoded.tobytes()


def test_reader_returns_only_unseen_frames() -> None:
    reader = PushFrameReader()
    assert reader.read_latest(0) == (None, 0)
    reader.push(np.zeros((10, 20, 3), dtype=np.uint8))
    frame, counter = reader.read_latest(0)
    assert frame is not None and counter == 1
    assert reader.read_latest(counter) == (None, counter)


def test_reader_keeps_only_the_newest_frame() -> None:
    reader = PushFrameReader()
    reader.push(np.full((10, 20, 3), 1, dtype=np.uint8))
    reader.push(np.full((10, 20, 3), 2, dtype=np.uint8))
    frame, counter = reader.read_latest(0)
    assert frame is not None and counter == 2
    assert int(frame[0, 0, 0]) == 2


def test_reader_resizes_frames_to_the_first_shape() -> None:
    reader = PushFrameReader()
    reader.push(np.zeros((10, 20, 3), dtype=np.uint8))
    reader.push(np.zeros((40, 80, 3), dtype=np.uint8))
    frame, _ = reader.read_latest(0)
    assert frame is not None and frame.shape[:2] == (10, 20)


def test_manager_processes_pushed_frames_into_a_preview() -> None:
    manager = CaptureManager()
    assert manager.push_jpeg(_jpeg(64, 48)) is False  # nothing started yet
    manager.start(camera_id=1, source_uri=f"{BROWSER_SOURCE_PREFIX}test")
    try:
        assert manager.status == CameraStatus.RUNNING
        deadline = time.monotonic() + 5.0
        while manager.get_latest_jpeg() is None and time.monotonic() < deadline:
            assert manager.push_jpeg(_jpeg(64, 48)) is True
            time.sleep(0.05)
        assert manager.get_latest_jpeg() is not None
        assert manager.push_jpeg(b"not a jpeg") is True  # bad frames are dropped, not fatal
    finally:
        manager.stop()
    assert manager.status == CameraStatus.STOPPED
    assert manager.push_jpeg(_jpeg(64, 48)) is False
