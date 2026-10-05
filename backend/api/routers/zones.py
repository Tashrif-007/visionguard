from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dependencies import get_capture_pool, get_current_user, get_db
from backend.controllers import zone_controller
from backend.schemas.zone import CameraConfigRead, ScheduleWrite, ZoneWrite
from backend.services.capture_service import CapturePool

router = APIRouter(prefix="/cameras", tags=["zones"], dependencies=[Depends(get_current_user)])


@router.get("/{source_id}/config", response_model=CameraConfigRead)
def get_config(source_id: int, db: Session = Depends(get_db)) -> CameraConfigRead:
    return zone_controller.get_config(db, source_id)


@router.put("/{source_id}/zones", response_model=CameraConfigRead)
def save_zones(
    source_id: int,
    zones: list[ZoneWrite],
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraConfigRead:
    return zone_controller.save_zones(db, pool, source_id, zones)


@router.put("/{source_id}/schedule", response_model=CameraConfigRead)
def save_schedule(
    source_id: int,
    schedule: ScheduleWrite,
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraConfigRead:
    return zone_controller.save_schedule(db, pool, source_id, schedule)
