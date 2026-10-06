from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dependencies import get_capture_pool, get_current_user, get_db
from backend.controllers import zone_controller
from backend.db.models import User
from backend.schemas.zone import CameraConfigRead, ScheduleWrite, ZoneWrite
from backend.services.capture_service import CapturePool

router = APIRouter(prefix="/cameras", tags=["zones"], dependencies=[Depends(get_current_user)])


@router.get("/{camera_id}/config", response_model=CameraConfigRead)
def get_config(
    camera_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> CameraConfigRead:
    return zone_controller.get_config(db, camera_id, current_user.id)


@router.put("/{camera_id}/zones", response_model=CameraConfigRead)
def save_zones(
    camera_id: int,
    zones: list[ZoneWrite],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraConfigRead:
    return zone_controller.save_zones(db, pool, camera_id, current_user.id, zones)


@router.put("/{camera_id}/schedule", response_model=CameraConfigRead)
def save_schedule(
    camera_id: int,
    schedule: ScheduleWrite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraConfigRead:
    return zone_controller.save_schedule(db, pool, camera_id, current_user.id, schedule)
