from datetime import time

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.db.models import CameraSchedule, CameraZone


def get_zones(db: Session, camera_id: int) -> list[CameraZone]:
    stmt = select(CameraZone).where(CameraZone.camera_id == camera_id).order_by(CameraZone.id)
    return list(db.execute(stmt).scalars().all())


def replace_zones(db: Session, camera_id: int, zones: list[tuple[str, str, list[list[float]]]]) -> list[CameraZone]:
    db.execute(delete(CameraZone).where(CameraZone.camera_id == camera_id))
    rows = [CameraZone(camera_id=camera_id, name=n, mode=m, points=p) for n, m, p in zones]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def get_schedule(db: Session, camera_id: int) -> CameraSchedule | None:
    return db.execute(
        select(CameraSchedule).where(CameraSchedule.camera_id == camera_id)
    ).scalar_one_or_none()


def upsert_schedule(
    db: Session, camera_id: int, enabled: bool, weekdays: list[int], start_time: time, end_time: time
) -> CameraSchedule:
    schedule = get_schedule(db, camera_id)
    if schedule is None:
        schedule = CameraSchedule(camera_id=camera_id)
        db.add(schedule)
    schedule.enabled = enabled
    schedule.weekdays = weekdays
    schedule.start_time = start_time
    schedule.end_time = end_time
    db.commit()
    db.refresh(schedule)
    return schedule


def delete_schedule(db: Session, camera_id: int) -> None:
    db.execute(delete(CameraSchedule).where(CameraSchedule.camera_id == camera_id))
    db.commit()
