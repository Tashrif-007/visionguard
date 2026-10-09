import logging
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import Camera
from backend.db.repositories import camera_repository
from backend.services import zone_service
from backend.services.capture_service import BROWSER_SOURCE_PREFIX, CaptureError, CapturePool
from backend.services.zone_service import CameraNotFoundError

logger = logging.getLogger(__name__)


class DuplicateCameraError(Exception):
    """Raised when another camera already uses the requested source URI."""


class CameraBusyError(Exception):
    """Raised when an operation needs the camera stopped (or not yet running)."""


class CameraSourceError(Exception):
    """Raised when an operation does not fit the camera's source type."""


BROWSER_SOURCE_TYPE = "browser"
_SOURCE_TYPES_KEPT_ON_EDIT = ("upload", BROWSER_SOURCE_TYPE)


def _infer_source_type(source_uri: str) -> str:
    if source_uri.startswith(BROWSER_SOURCE_PREFIX):
        return BROWSER_SOURCE_TYPE
    return "webcam" if source_uri.isdigit() else "ip_camera"


def _require_camera(db: Session, camera_id: int, owner_id: int) -> Camera:
    camera = camera_repository.get_by_id(db, camera_id, owner_id)
    if camera is None:
        raise CameraNotFoundError(f"Camera {camera_id} not found")
    return camera


def get_camera(db: Session, camera_id: int, owner_id: int) -> Camera:
    return _require_camera(db, camera_id, owner_id)


def _register(db: Session, name: str, source_type: str, source_uri: str, created_by: int) -> Camera:
    existing = camera_repository.get_by_uri(db, source_uri, created_by)
    if existing is None:
        camera = camera_repository.create_camera(db, name, source_type, source_uri, created_by)
        logger.info("Registered camera id=%d uri=%s", camera.id, source_uri)
        return camera
    if existing.deleted_at is None:
        raise DuplicateCameraError(f"Camera '{existing.name}' already uses this source")
    # Re-adding a deleted camera brings back its history, zones and schedule.
    camera = camera_repository.restore(db, existing, name, source_type)
    logger.info("Restored deleted camera id=%d uri=%s", camera.id, source_uri)
    return camera


def list_cameras(db: Session, owner_id: int) -> list[Camera]:
    return camera_repository.list_cameras(db, owner_id)


def register_camera(
    db: Session, name: str | None, source_uri: str | None, created_by: int
) -> Camera:
    uri = (source_uri if source_uri is not None else settings.video_source).strip()
    source_type = _infer_source_type(uri)
    default_name = "Browser camera" if source_type == BROWSER_SOURCE_TYPE else f"{source_type}:{uri}"
    return _register(db, name or default_name, source_type, uri, created_by)


def update_camera(
    db: Session, pool: CapturePool, camera_id: int, owner_id: int, name: str | None, source_uri: str | None
) -> Camera:
    camera = _require_camera(db, camera_id, owner_id)
    new_uri = source_uri.strip() if source_uri is not None else camera.source_uri
    if new_uri != camera.source_uri:
        if pool.is_running(camera_id):
            raise CameraBusyError("Stop the camera before changing its source")
        if camera_repository.get_by_uri(db, new_uri, owner_id) is not None:
            raise DuplicateCameraError("Another camera already uses this source")
    source_type = (
        camera.source_type if camera.source_type in _SOURCE_TYPES_KEPT_ON_EDIT else _infer_source_type(new_uri)
    )
    return camera_repository.update_camera(db, camera, name or camera.name, new_uri, source_type)


def delete_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> None:
    camera = _require_camera(db, camera_id, owner_id)
    pool.stop(camera_id)
    camera_repository.soft_delete(db, camera)
    logger.info("Deleted camera id=%d (events kept)", camera_id)


def _start(db: Session, pool: CapturePool, camera: Camera) -> Camera:
    if pool.is_running(camera.id):
        raise CameraBusyError(f"Camera '{camera.name}' is already running")
    pool.start(
        camera_id=camera.id,
        source_uri=camera.source_uri,
        config=zone_service.load_runtime_config(db, camera.id),
    )
    logger.info("Started camera id=%d uri=%s", camera.id, camera.source_uri)
    return camera


def start_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> Camera:
    camera = _require_camera(db, camera_id, owner_id)
    if camera.source_type == BROWSER_SOURCE_TYPE:
        raise CameraSourceError("A browser camera starts streaming from the browser that hosts the camera")
    return _start(db, pool, camera)


def start_browser_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> Camera:
    """Start a browser camera; called when its browser opens the frame stream."""
    camera = _require_camera(db, camera_id, owner_id)
    if camera.source_type != BROWSER_SOURCE_TYPE:
        raise CameraSourceError(f"Camera '{camera.name}' is not a browser camera")
    return _start(db, pool, camera)


def stop_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> Camera:
    camera = _require_camera(db, camera_id, owner_id)
    pool.stop(camera_id)
    logger.info("Stopped camera id=%d", camera_id)
    return camera


def upload_video(
    db: Session,
    pool: CapturePool,
    filename: str | None,
    file: BinaryIO,
    created_by: int,
) -> Camera:
    """Save an uploaded file, register it as an `upload` camera and start it."""
    original_name = filename or "upload"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path = upload_dir / f"{uuid.uuid4().hex}_{Path(original_name).name}"
    with saved_path.open("wb") as out:
        shutil.copyfileobj(file, out)
    logger.info("Saved uploaded video to %s", saved_path)

    camera = _register(db, original_name, "upload", str(saved_path), created_by)
    try:
        return start_camera(db, pool, camera.id, created_by)
    except CaptureError:
        # Not a playable video: don't keep a camera (or a file) nobody can start.
        camera_repository.delete_camera(db, camera)
        saved_path.unlink(missing_ok=True)
        raise
