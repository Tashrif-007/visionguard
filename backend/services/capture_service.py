import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np

from backend.config import settings
from backend.db.database import SessionLocal
from backend.db.repositories import video_source_repository
from backend.models.tiny_cnn import TinyTransmissionCNN
from backend.services import event_service, pipeline
from backend.services.motion.motion_detector import MotionDetector
from backend.services.motion.roi import ROIBox, extract_roi

logger = logging.getLogger(__name__)


class CaptureError(Exception):
    """Raised when a video source cannot be opened for capture."""


class _LatestFrameReader:
    """Background reader for live sources: keeps only the newest frame.

    A dedicated thread continuously calls capture.read() and stores just the
    most recent frame behind a lock, discarding anything the processing loop
    hasn't kept up with. This bounds capture lag to ~1 frame regardless of
    how slow downstream processing is, instead of frames backing up
    unboundedly when the pipeline falls behind the camera's real framerate.
    """

    def __init__(self, capture: cv2.VideoCapture) -> None:
        self._capture = capture
        self._lock = threading.Lock()
        self._frame: np.ndarray | None = None
        self._counter = 0
        self._ended = False
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, name="capture-reader", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=5.0)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            ret, frame = self._capture.read()
            if not ret:
                self._ended = True
                return
            with self._lock:
                self._frame = frame
                self._counter += 1

    def read_latest(self, last_seen: int) -> tuple[np.ndarray | None, int]:
        with self._lock:
            if self._counter == last_seen:
                return None, last_seen
            return self._frame, self._counter

    @property
    def ended(self) -> bool:
        return self._ended


class CaptureManager:
    """Owns the background capture thread and the latest processed frame."""

    def __init__(self, model: TinyTransmissionCNN | None = None) -> None:
        self._model = model
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._frame_lock = threading.Lock()
        self._latest_jpeg: bytes | None = None

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def get_latest_jpeg(self) -> bytes | None:
        with self._frame_lock:
            return self._latest_jpeg

    def start(self, source_id: int, source_uri: str) -> None:
        self.stop()
        capture = cv2.VideoCapture(int(source_uri) if source_uri.isdigit() else source_uri)
        if not capture.isOpened():
            capture.release()
            raise CaptureError(f"Cannot open video source: {source_uri}")
        capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # best-effort; ignored by some backends

        is_file = Path(source_uri).is_file()
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            args=(capture, source_id, is_file),
            name=f"capture-source-{source_id}",
            daemon=True,
        )
        self._thread.start()
        logger.info("Capture started for source id=%d uri=%s", source_id, source_uri)

    def stop(self) -> None:
        if self._thread is None:
            return
        self._stop_event.set()
        self._thread.join(timeout=5.0)
        if self._thread.is_alive():
            logger.warning("Capture thread did not stop within timeout")
        self._thread = None
        with self._frame_lock:
            self._latest_jpeg = None
        logger.info("Capture stopped")

    def _run(self, capture: cv2.VideoCapture, source_id: int, is_file: bool) -> None:
        detector = MotionDetector(max_side=settings.motion_max_side)
        try:
            with ThreadPoolExecutor(max_workers=1, thread_name_prefix="event-log") as executor:
                if is_file:
                    self._run_file_source(capture, source_id, detector, executor)
                else:
                    self._run_live_source(capture, source_id, detector, executor)
        except Exception:
            logger.exception("Capture loop for source id=%d crashed; deactivating", source_id)
            self._deactivate_source(source_id)
        finally:
            capture.release()

    def _run_file_source(
        self,
        capture: cv2.VideoCapture,
        source_id: int,
        detector: MotionDetector,
        executor: ThreadPoolExecutor,
    ) -> None:
        fps = capture.get(cv2.CAP_PROP_FPS)
        frame_delay = 1.0 / fps if fps > 0 else 1.0 / 30.0

        frame_number = 0
        last_event_time = 0.0
        last_preview_at = 0.0
        next_frame_at = time.monotonic()

        while not self._stop_event.is_set():
            ret, frame = capture.read()
            if not ret:
                logger.info("Source id=%d ended; deactivating", source_id)
                self._deactivate_source(source_id)
                return
            frame_number += 1
            last_event_time, last_preview_at = self._process_frame(
                frame, source_id, frame_number, detector, executor, last_event_time, last_preview_at
            )

            next_frame_at += frame_delay
            sleep_for = next_frame_at - time.monotonic()
            if sleep_for > 0:
                time.sleep(sleep_for)
            elif sleep_for < -frame_delay * settings.capture_max_lag_frames:
                # Fallen far behind real-time playback: decode-skip (grab, no
                # colour convert) to catch up rather than playing back slower
                # and slower.
                skipped = min(int(-sleep_for / frame_delay), settings.capture_max_lag_frames)
                for _ in range(skipped):
                    capture.grab()
                next_frame_at = time.monotonic()

    def _run_live_source(
        self,
        capture: cv2.VideoCapture,
        source_id: int,
        detector: MotionDetector,
        executor: ThreadPoolExecutor,
    ) -> None:
        reader = _LatestFrameReader(capture)
        reader.start()
        try:
            frame_number = 0
            last_event_time = 0.0
            last_preview_at = 0.0
            last_seen = 0
            while not self._stop_event.is_set():
                frame, last_seen = reader.read_latest(last_seen)
                if frame is None:
                    if reader.ended:
                        logger.info("Source id=%d ended or failed; deactivating", source_id)
                        self._deactivate_source(source_id)
                        return
                    time.sleep(0.002)
                    continue
                frame_number += 1
                last_event_time, last_preview_at = self._process_frame(
                    frame, source_id, frame_number, detector, executor, last_event_time, last_preview_at
                )
        finally:
            reader.stop()

    def _process_frame(
        self,
        frame: np.ndarray,
        source_id: int,
        frame_number: int,
        detector: MotionDetector,
        executor: ThreadPoolExecutor,
        last_event_time: float,
        last_preview_at: float,
    ) -> tuple[float, float]:
        mask = detector.apply(frame)
        bbox: ROIBox | None = None
        if frame_number > settings.motion_warmup_frames:
            bbox = extract_roi(
                mask,
                min_area=settings.motion_min_area,
                padding=settings.roi_padding,
                frame_shape=frame.shape[:2],
                max_area_ratio=settings.roi_max_area_ratio,
            )

        if bbox is not None:
            roi_slice = frame[bbox.y : bbox.y + bbox.height, bbox.x : bbox.x + bbox.width]
            frame[bbox.y : bbox.y + bbox.height, bbox.x : bbox.x + bbox.width] = (
                pipeline.dehaze_roi(roi_slice, model=self._model)
            )
            now = time.monotonic()
            if now - last_event_time >= settings.event_cooldown_seconds:
                last_event_time = now
                # Snapshot the frame (copy) before drawing the rectangle below,
                # then log off-thread so disk I/O and the DB insert never
                # stall the next capture.read().
                executor.submit(self._log_event, source_id, frame.copy(), bbox, frame_number)
            cv2.rectangle(
                frame,
                (bbox.x, bbox.y),
                (bbox.x + bbox.width, bbox.y + bbox.height),
                (0, 255, 0),
                2,
            )

        now = time.monotonic()
        if now - last_preview_at >= 1.0 / settings.preview_fps:
            last_preview_at = now
            preview = frame
            height, width = frame.shape[:2]
            if width > settings.preview_max_width:
                scale = settings.preview_max_width / width
                preview = cv2.resize(
                    frame,
                    (settings.preview_max_width, max(1, round(height * scale))),
                    interpolation=cv2.INTER_AREA,
                )
            ok, encoded = cv2.imencode(
                ".jpg", preview, [int(cv2.IMWRITE_JPEG_QUALITY), settings.preview_jpeg_quality]
            )
            if ok:
                with self._frame_lock:
                    self._latest_jpeg = encoded.tobytes()

        return last_event_time, last_preview_at

    def _log_event(self, source_id: int, frame: np.ndarray, bbox: ROIBox, frame_number: int) -> None:
        db = SessionLocal()
        try:
            event_service.log_motion_event(
                db=db,
                source_id=source_id,
                frame=frame,
                bbox=bbox,
                frame_number=frame_number,
            )
        except Exception:
            logger.exception("Failed to log motion event for source id=%d", source_id)
        finally:
            db.close()

    def _deactivate_source(self, source_id: int) -> None:
        db = SessionLocal()
        try:
            video_source_repository.deactivate_source(db, source_id)
        except Exception:
            logger.exception("Failed to deactivate source id=%d after capture end", source_id)
        finally:
            db.close()


class CapturePool:
    """Owns one CaptureManager per concurrently active video source.

    Each source gets its own capture thread, motion detector, and latest-JPEG
    buffer, so multiple cameras/uploads can run and be viewed side by side —
    starting one no longer stops any other.
    """

    def __init__(self, model: TinyTransmissionCNN | None = None) -> None:
        self._model = model
        self._lock = threading.Lock()
        self._managers: dict[int, CaptureManager] = {}

    def start(self, source_id: int, source_uri: str) -> None:
        manager = CaptureManager(model=self._model)
        manager.start(source_id=source_id, source_uri=source_uri)
        with self._lock:
            self._managers[source_id] = manager

    def stop(self, source_id: int) -> None:
        with self._lock:
            manager = self._managers.pop(source_id, None)
        if manager is not None:
            manager.stop()

    def stop_all(self) -> None:
        with self._lock:
            managers = list(self._managers.values())
            self._managers.clear()
        for manager in managers:
            manager.stop()

    def get_latest_jpeg(self, source_id: int) -> bytes | None:
        with self._lock:
            manager = self._managers.get(source_id)
        return manager.get_latest_jpeg() if manager is not None else None

    def is_running(self, source_id: int) -> bool:
        with self._lock:
            manager = self._managers.get(source_id)
        return manager is not None and manager.is_running
