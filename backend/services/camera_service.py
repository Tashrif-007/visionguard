import logging
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import VideoSource
from backend.db.repositories import video_source_repository
from backend.services.capture_service import CaptureError, CapturePool

logger = logging.getLogger(__name__)


class NoActiveSourceError(Exception):
    """Raised when an operation requires an active video source but none exists."""


def _infer_source_type(source_uri: str) -> str:
    return "webcam" if source_uri.isdigit() else "ip_camera"


def _activate_and_capture(
    db: Session,
    pool: CapturePool,
    name: str,
    source_type: str,
    source_uri: str,
    created_by: int | None = None,
) -> VideoSource:
    source = video_source_repository.create_source(
        db=db,
        name=name,
        source_type=source_type,
        source_uri=source_uri,
        is_active=True,
        created_by=created_by,
    )
    try:
        pool.start(source_id=source.id, source_uri=source_uri)
    except CaptureError:
        video_source_repository.deactivate_source(db, source.id)
        logger.warning("Capture failed to start for uri=%s; source deactivated", source_uri)
        raise
    logger.info("Source id=%d uri=%s type=%s is now active and capturing", source.id, source_uri, source_type)
    db.refresh(source)
    return source


def start_camera(
    db: Session,
    pool: CapturePool,
    name: str | None,
    source_uri: str | None,
    created_by: int | None = None,
) -> VideoSource:
    uri = source_uri if source_uri is not None else settings.video_source
    source_type = _infer_source_type(uri)
    return _activate_and_capture(
        db=db,
        pool=pool,
        name=name or f"{source_type}:{uri}",
        source_type=source_type,
        source_uri=uri,
        created_by=created_by,
    )


def stop_camera(db: Session, pool: CapturePool, source_id: int) -> VideoSource:
    source = video_source_repository.get_by_id(db, source_id)
    if source is None or not source.is_active:
        raise NoActiveSourceError(f"No active video source with id={source_id}")
    pool.stop(source_id)
    video_source_repository.deactivate_source(db, source_id)
    db.refresh(source)
    logger.info("Stopped camera source id=%d", source.id)
    return source


def register_upload(
    db: Session,
    pool: CapturePool,
    filename: str | None,
    file: BinaryIO,
    created_by: int | None = None,
) -> VideoSource:
    original_name = filename or "upload"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_path = upload_dir / f"{uuid.uuid4().hex}_{Path(original_name).name}"
    with saved_path.open("wb") as out:
        shutil.copyfileobj(file, out)
    logger.info("Saved uploaded video to %s", saved_path)
    return _activate_and_capture(
        db=db,
        pool=pool,
        name=original_name,
        source_type="upload",
        source_uri=str(saved_path),
        created_by=created_by,
    )


def list_active_cameras(db: Session) -> list[VideoSource]:
    return video_source_repository.get_active_sources(db)
