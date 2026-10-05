import logging

from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import CameraSchedule, CameraZone
from backend.db.repositories import video_source_repository, zone_repository
from backend.schemas.zone import CameraConfigRead, ScheduleRead, ScheduleWrite, ZoneRead, ZoneWrite
from backend.services import schedule as schedule_utils
from backend.services.camera_config import CameraConfig, Schedule, Zone

logger = logging.getLogger(__name__)


class SourceNotFoundError(Exception):
    """Raised when the video source for a config operation doesn't exist."""


class InvalidZoneError(Exception):
    """Raised when submitted zones/schedule fail validation."""


def _require_source(db: Session, source_id: int) -> str:
    source = video_source_repository.get_by_id(db, source_id)
    if source is None:
        raise SourceNotFoundError(f"Video source {source_id} not found")
    return source.source_uri


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


def load_runtime_config(db: Session, source_id: int) -> CameraConfig:
    return _to_runtime(zone_repository.get_zones(db, source_id), zone_repository.get_schedule(db, source_id))


def get_config(db: Session, source_id: int) -> CameraConfigRead:
    _require_source(db, source_id)
    zones = zone_repository.get_zones(db, source_id)
    schedule = zone_repository.get_schedule(db, source_id)
    runtime = _to_runtime(zones, schedule)
    return CameraConfigRead(
        source_id=source_id,
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


def save_zones(db: Session, source_id: int, zones: list[ZoneWrite]) -> CameraConfig:
    _require_source(db, source_id)
    _validate_zones(zones)
    zone_repository.replace_zones(db, source_id, [(z.name, z.mode, z.points) for z in zones])
    logger.info("Saved %d zone(s) for source id=%d", len(zones), source_id)
    return load_runtime_config(db, source_id)


def save_schedule(db: Session, source_id: int, schedule: ScheduleWrite) -> CameraConfig:
    _require_source(db, source_id)
    _validate_schedule(schedule)
    zone_repository.upsert_schedule(
        db,
        source_id,
        enabled=schedule.enabled,
        weekdays=sorted(set(schedule.weekdays)),
        start_time=schedule.start_time,
        end_time=schedule.end_time,
    )
    logger.info("Saved schedule for source id=%d", source_id)
    return load_runtime_config(db, source_id)


def inherit_config(db: Session, source_id: int, source_uri: str) -> None:
    """Copy zones/schedule from the latest earlier source with the same URI.

    Re-adding a camera creates a new source row; this keeps its settings.
    """
    previous_id = zone_repository.find_previous_config_source_id(db, source_uri, source_id)
    if previous_id is None:
        return
    zones = zone_repository.get_zones(db, previous_id)
    if zones:
        zone_repository.replace_zones(db, source_id, [(z.name, z.mode, z.points) for z in zones])
    schedule = zone_repository.get_schedule(db, previous_id)
    if schedule is not None:
        zone_repository.upsert_schedule(
            db, source_id, schedule.enabled, schedule.weekdays, schedule.start_time, schedule.end_time
        )
    logger.info("Source id=%d inherited zones/schedule from source id=%d", source_id, previous_id)
