from collections.abc import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.schemas.zone import CameraConfigRead, ScheduleWrite, ZoneWrite
from backend.services import zone_service
from backend.services.camera_config import CameraConfig
from backend.services.capture_service import CapturePool
from backend.services.zone_service import InvalidZoneError, CameraNotFoundError


def get_config(db: Session, camera_id: int, owner_id: int) -> CameraConfigRead:
    try:
        return zone_service.get_config(db, camera_id, owner_id)
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def save_zones(
    db: Session, pool: CapturePool, camera_id: int, owner_id: int, zones: list[ZoneWrite]
) -> CameraConfigRead:
    return _save(db, pool, camera_id, owner_id, lambda: zone_service.save_zones(db, camera_id, owner_id, zones))


def save_schedule(
    db: Session, pool: CapturePool, camera_id: int, owner_id: int, schedule: ScheduleWrite
) -> CameraConfigRead:
    return _save(
        db, pool, camera_id, owner_id, lambda: zone_service.save_schedule(db, camera_id, owner_id, schedule)
    )


def _save(
    db: Session, pool: CapturePool, camera_id: int, owner_id: int, action: Callable[[], CameraConfig]
) -> CameraConfigRead:
    try:
        runtime = action()
    except CameraNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidZoneError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    pool.update_config(camera_id, runtime)
    return zone_service.get_config(db, camera_id, owner_id)
