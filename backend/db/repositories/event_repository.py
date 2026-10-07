from datetime import datetime

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session

from backend.db.models import Camera, Event


def create_event(
    db: Session,
    camera_id: int,
    event_type: str,
    timestamp: datetime,
    image_path: str,
    roi_x: int,
    roi_y: int,
    roi_width: int,
    roi_height: int,
    roi_area_ratio: float | None = None,
    frame_number: int | None = None,
    clip_path: str | None = None,
) -> Event:
    event = Event(
        camera_id=camera_id,
        event_type=event_type,
        timestamp=timestamp,
        image_path=image_path,
        roi_x=roi_x,
        roi_y=roi_y,
        roi_width=roi_width,
        roi_height=roi_height,
        roi_area_ratio=roi_area_ratio,
        frame_number=frame_number,
        clip_path=clip_path,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_event_by_id(db: Session, event_id: int, owner_id: int) -> Event | None:
    stmt = (
        select(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .where(Event.id == event_id, Camera.created_by == owner_id)
    )
    return db.execute(stmt).scalar_one_or_none()


def delete_event(db: Session, event: Event) -> None:
    db.delete(event)
    db.commit()


def get_events(
    db: Session,
    owner_id: int,
    camera_id: int | None = None,
    event_type: str | None = None,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Event], int]:
    base = select(Event).join(Camera, Camera.id == Event.camera_id).where(Camera.created_by == owner_id)
    count_base = (
        select(func.count())
        .select_from(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .where(Camera.created_by == owner_id)
    )

    if camera_id is not None:
        base = base.where(Event.camera_id == camera_id)
        count_base = count_base.where(Event.camera_id == camera_id)
    if event_type is not None:
        base = base.where(Event.event_type == event_type)
        count_base = count_base.where(Event.event_type == event_type)
    if from_ts is not None:
        base = base.where(Event.timestamp >= from_ts)
        count_base = count_base.where(Event.timestamp >= from_ts)
    if to_ts is not None:
        base = base.where(Event.timestamp <= to_ts)
        count_base = count_base.where(Event.timestamp <= to_ts)

    total: int = db.execute(count_base).scalar_one()
    rows = db.execute(base.order_by(Event.timestamp.desc()).offset(offset).limit(limit)).scalars().all()

    return list(rows), total


# Coverage buckets as (label, upper bound exclusive) over roi_area_ratio.
COVERAGE_BUCKETS: tuple[tuple[str, float], ...] = (
    ("<5%", 0.05),
    ("5-15%", 0.15),
    ("15-35%", 0.35),
    (">35%", float("inf")),
)


def _filtered(
    stmt: Select,  # type: ignore[type-arg]
    owner_id: int,
    camera_id: int | None,
    from_ts: datetime | None,
    to_ts: datetime | None,
) -> Select:  # type: ignore[type-arg]
    stmt = stmt.where(Camera.created_by == owner_id)
    if camera_id is not None:
        stmt = stmt.where(Event.camera_id == camera_id)
    if from_ts is not None:
        stmt = stmt.where(Event.timestamp >= from_ts)
    if to_ts is not None:
        stmt = stmt.where(Event.timestamp <= to_ts)
    return stmt


def _local_ts(timezone_name: str):  # type: ignore[no-untyped-def]
    """Event.timestamp is stored as naive UTC; convert to a naive local timestamp."""
    return func.timezone(timezone_name, func.timezone("UTC", Event.timestamp))


def count_per_day(
    db: Session, owner_id: int, timezone_name: str, camera_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> list[tuple[str, int]]:
    day = func.date(_local_ts(timezone_name))
    stmt = _filtered(
        select(day, func.count())
        .select_from(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .group_by(day)
        .order_by(day),
        owner_id,
        camera_id,
        from_ts,
        to_ts,
    )
    return [(str(d), n) for d, n in db.execute(stmt).all()]


def count_per_camera(
    db: Session, owner_id: int, camera_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> list[tuple[int, str, int]]:
    stmt = _filtered(
        select(Camera.id, Camera.name, func.count())
        .select_from(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .group_by(Camera.id, Camera.name)
        .order_by(func.count().desc()),
        owner_id,
        camera_id,
        from_ts,
        to_ts,
    )
    return [(cid, name, n) for cid, name, n in db.execute(stmt).all()]


def count_heatmap(
    db: Session, owner_id: int, timezone_name: str, camera_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> list[tuple[int, int, int]]:
    local = _local_ts(timezone_name)
    weekday = func.extract("isodow", local) - 1
    hour = func.extract("hour", local)
    stmt = _filtered(
        select(weekday, hour, func.count())
        .select_from(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .group_by(weekday, hour),
        owner_id,
        camera_id,
        from_ts,
        to_ts,
    )
    return [(int(w), int(h), n) for w, h, n in db.execute(stmt).all()]


def count_coverage(
    db: Session, owner_id: int, camera_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> list[tuple[str, int]]:
    whens = []
    for label, upper in COVERAGE_BUCKETS:
        whens.append((Event.roi_area_ratio < upper, label))
    bucket = case(*whens, else_="unknown")
    stmt = _filtered(
        select(bucket, func.count())
        .select_from(Event)
        .join(Camera, Camera.id == Event.camera_id)
        .group_by(bucket),
        owner_id,
        camera_id,
        from_ts,
        to_ts,
    )
    return [(label, n) for label, n in db.execute(stmt).all()]
