import logging

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import CameraSchedule, CameraZone
from backend.db.repositories import camera_repository, zone_repository
from backend.schemas.zone import CameraConfigRead, ScheduleRead, ScheduleWrite, ZoneRead, ZoneWrite
from backend.services import schedule as schedule_utils
from backend.services.camera_config import CameraConfig, Schedule, Zone

logger = logging.getLogger(__name__)


class CameraNotFoundError(Exception):
    """Raised when a camera id doesn't exist (or the camera was deleted)."""


class InvalidZoneError(Exception):
    """Raised when submitted zones/schedule fail validation."""


def _require_camera(db: Session, camera_id: int, owner_id: int) -> None:
    if camera_repository.get_by_id(db, camera_id, owner_id) is None:
        raise CameraNotFoundError(f"Camera {camera_id} not found")


def _validate_zones(zones: list[ZoneWrite]) -> None:
    if len(zones) > settings.max_zones_per_camera:
        raise InvalidZoneError(f"At most {settings.max_zones_per_camera} zones per camera")
    for zone in zones:
        for point in zone.points:
            if len(point) != 2 or not all(0.0 <= v <= 1.0 for v in point):
                raise InvalidZoneError(f"Zone '{zone.name}' has a point outside the 0-1 range")


def _validate_schedule(schedule: ScheduleWrite) -> None:
    if not all(0 <= d <= 6 for d in schedule.weekdays):
        raise InvalidZoneError("Weekdays must be between 0 (Mon) and 6 (Sun)")
    if schedule.start_time == schedule.end_time:
        raise InvalidZoneError("Schedule start and end time must differ")


def _to_runtime(zones: list[CameraZone], schedule: CameraSchedule | None) -> CameraConfig:
    return CameraConfig(
        zones=tuple(Zone(z.name, z.mode, tuple((p[0], p[1]) for p in z.points)) for z in zones),
        schedule=(
            Schedule(schedule.enabled, frozenset(schedule.weekdays), schedule.start_time, schedule.end_time)
            if schedule is not None
            else None
        ),
    )


def load_runtime_config(db: Session, camera_id: int) -> CameraConfig:
    return _to_runtime(zone_repository.get_zones(db, camera_id), zone_repository.get_schedule(db, camera_id))


def get_config(db: Session, camera_id: int, owner_id: int) -> CameraConfigRead:
    _require_camera(db, camera_id, owner_id)
    zones = zone_repository.get_zones(db, camera_id)
    schedule = zone_repository.get_schedule(db, camera_id)
    runtime = _to_runtime(zones, schedule)
    return CameraConfigRead(
        camera_id=camera_id,
        zones=[ZoneRead(id=z.id, name=z.name, mode=z.mode, points=z.points) for z in zones],
        schedule=(
            ScheduleRead(
                enabled=schedule.enabled,
                weekdays=schedule.weekdays,
                start_time=schedule.start_time,
                end_time=schedule.end_time,
            )
            if schedule is not None
            else None
        ),
        armed=schedule_utils.is_armed(
            schedule_utils.now_in_timezone(settings.schedule_timezone), runtime.schedule
        ),
    )


def save_zones(db: Session, camera_id: int, owner_id: int, zones: list[ZoneWrite]) -> CameraConfig:
    _require_camera(db, camera_id, owner_id)
    _validate_zones(zones)
    zone_repository.replace_zones(db, camera_id, [(z.name, z.mode, z.points) for z in zones])
    logger.info("Saved %d zone(s) for camera id=%d", len(zones), camera_id)
    return load_runtime_config(db, camera_id)


def save_schedule(db: Session, camera_id: int, owner_id: int, schedule: ScheduleWrite) -> CameraConfig:
    _require_camera(db, camera_id, owner_id)
    _validate_schedule(schedule)
    zone_repository.upsert_schedule(
        db,
        camera_id,
        enabled=schedule.enabled,
        weekdays=sorted(set(schedule.weekdays)),
        start_time=schedule.start_time,
        end_time=schedule.end_time,
    )
    logger.info("Saved schedule for camera id=%d", camera_id)
    return load_runtime_config(db, camera_id)
