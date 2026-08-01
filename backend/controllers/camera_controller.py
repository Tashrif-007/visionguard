from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.schemas.camera import StartCameraRequest, VideoSourceRead
from backend.services import camera_service
from backend.services.camera_service import NoActiveSourceError
from backend.services.capture_service import CaptureError, CapturePool


def start_camera(
    db: Session,
    pool: CapturePool,
    request: StartCameraRequest,
    created_by: int | None = None,
) -> VideoSourceRead:
    try:
        source = camera_service.start_camera(
            db=db, pool=pool, name=request.name, source_uri=request.source_uri, created_by=created_by
        )
    except CaptureError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return VideoSourceRead.model_validate(source)


def stop_camera(db: Session, pool: CapturePool, source_id: int) -> VideoSourceRead:
    try:
        source = camera_service.stop_camera(db=db, pool=pool, source_id=source_id)
    except NoActiveSourceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return VideoSourceRead.model_validate(source)


def upload_video(
    db: Session, pool: CapturePool, file: UploadFile, created_by: int | None = None
) -> VideoSourceRead:
    try:
        source = camera_service.register_upload(
            db=db, pool=pool, filename=file.filename, file=file.file, created_by=created_by
        )
    except CaptureError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return VideoSourceRead.model_validate(source)


def get_frame(pool: CapturePool, source_id: int) -> bytes:
    frame = pool.get_latest_jpeg(source_id)
    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No frame available for this source — it may not be running",
        )
    return frame


def list_active_cameras(db: Session) -> list[VideoSourceRead]:
    sources = camera_service.list_active_cameras(db)
    return [VideoSourceRead.model_validate(s) for s in sources]
