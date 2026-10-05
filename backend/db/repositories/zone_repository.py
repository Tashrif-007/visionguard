from datetime import time

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.db.models import CameraSchedule, CameraZone, VideoSource


def get_zones(db: Session, source_id: int) -> list[CameraZone]:
    stmt = select(CameraZone).where(CameraZone.source_id == source_id).order_by(CameraZone.id)
    return list(db.execute(stmt).scalars().all())


def replace_zones(db: Session, source_id: int, zones: list[tuple[str, str, list[list[float]]]]) -> list[CameraZone]:
    db.execute(delete(CameraZone).where(CameraZone.source_id == source_id))
    rows = [CameraZone(source_id=source_id, name=n, mode=m, points=p) for n, m, p in zones]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def get_schedule(db: Session, source_id: int) -> CameraSchedule | None:
    return db.execute(
        select(CameraSchedule).where(CameraSchedule.source_id == source_id)
    ).scalar_one_or_none()


def upsert_schedule(
    db: Session, source_id: int, enabled: bool, weekdays: list[int], start_time: time, end_time: time
) -> CameraSchedule:
    schedule = get_schedule(db, source_id)
    if schedule is None:
        schedule = CameraSchedule(source_id=source_id)
        db.add(schedule)
    schedule.enabled = enabled
    schedule.weekdays = weekdays
    schedule.start_time = start_time
    schedule.end_time = end_time
    db.commit()
    db.refresh(schedule)
    return schedule


def delete_schedule(db: Session, source_id: int) -> None:
    db.execute(delete(CameraSchedule).where(CameraSchedule.source_id == source_id))
    db.commit()


def find_previous_config_source_id(db: Session, source_uri: str, exclude_source_id: int) -> int | None:
    """Latest earlier source with the same URI that has zones or a schedule."""
    has_config = (
        select(CameraZone.source_id).union(select(CameraSchedule.source_id)).scalar_subquery()
    )
    stmt = (
        select(VideoSource.id)
        .where(
            VideoSource.source_uri == source_uri,
            VideoSource.id != exclude_source_id,
            VideoSource.id.in_(has_config),
        )
        .order_by(VideoSource.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()
