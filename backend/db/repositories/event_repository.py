from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import Event


def create_event(
    db: Session,
    source_id: int,
    event_type: str,
    timestamp: datetime,
    image_path: str,
    roi_x: int,
    roi_y: int,
    roi_width: int,
    roi_height: int,
    frame_number: int | None = None,
) -> Event:
    event = Event(
        source_id=source_id,
        event_type=event_type,
        timestamp=timestamp,
        image_path=image_path,
        roi_x=roi_x,
        roi_y=roi_y,
        roi_width=roi_width,
        roi_height=roi_height,
        frame_number=frame_number,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def get_events(
    db: Session,
    source_id: int | None = None,
    event_type: str | None = None,
    from_ts: datetime | None = None,
    to_ts: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Event], int]:
    base = select(Event)
    count_base = select(func.count()).select_from(Event)

    if source_id is not None:
        base = base.where(Event.source_id == source_id)
        count_base = count_base.where(Event.source_id == source_id)
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
