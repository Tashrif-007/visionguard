from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.db.models import Camera
from backend.schemas.camera import CameraCreate, CameraRead, CameraUpdate
from backend.services import camera_service
from backend.services.camera_service import CameraBusyError, CameraSourceError, DuplicateCameraError
from backend.services.capture_service import CaptureError, CapturePool
from backend.services.zone_service import CameraNotFoundError


def _to_read(camera: Camera, pool: CapturePool) -> CameraRead:
    return CameraRead(
        id=camera.id,
        name=camera.name,
        source_type=camera.source_type,
        source_uri=camera.source_uri,
        status=pool.status(camera.id),
        created_by=camera.created_by,
        created_at=camera.created_at,
    )


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, CameraNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (DuplicateCameraError, CameraBusyError)):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


_CAMERA_ERRORS = (CameraNotFoundError, DuplicateCameraError, CameraBusyError, CameraSourceError, CaptureError)


def list_cameras(db: Session, pool: CapturePool, owner_id: int) -> list[CameraRead]:
    return [_to_read(camera, pool) for camera in camera_service.list_cameras(db, owner_id)]


def register_camera(db: Session, pool: CapturePool, request: CameraCreate, created_by: int) -> CameraRead:
    try:
        camera = camera_service.register_camera(db, request.name, request.source_uri, created_by)
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc
    return _to_read(camera, pool)


def update_camera(
    db: Session, pool: CapturePool, camera_id: int, owner_id: int, request: CameraUpdate
) -> CameraRead:
    try:
        camera = camera_service.update_camera(
            db, pool, camera_id, owner_id, request.name, request.source_uri
        )
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc
    return _to_read(camera, pool)


def delete_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> None:
    try:
        camera_service.delete_camera(db, pool, camera_id, owner_id)
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc


def start_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> CameraRead:
    try:
        camera = camera_service.start_camera(db, pool, camera_id, owner_id)
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc
    return _to_read(camera, pool)


def stop_camera(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> CameraRead:
    try:
        camera = camera_service.stop_camera(db, pool, camera_id, owner_id)
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc
    return _to_read(camera, pool)


def upload_video(db: Session, pool: CapturePool, file: UploadFile, created_by: int) -> CameraRead:
    try:
        camera = camera_service.upload_video(db, pool, file.filename, file.file, created_by)
    except _CAMERA_ERRORS as exc:
        raise _http_error(exc) from exc
    return _to_read(camera, pool)


def get_frame(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> bytes:
    try:
        camera_service.get_camera(db, camera_id, owner_id)
    except CameraNotFoundError as exc:
        raise _http_error(exc) from exc
    frame = pool.get_latest_jpeg(camera_id)
    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No frame available for this camera — it may not be running",
        )
    return frame
