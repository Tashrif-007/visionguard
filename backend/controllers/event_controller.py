from datetime import datetime

from sqlalchemy.orm import Session

from backend.schemas.event import EventListResponse
from backend.services import event_service


def get_events(
    db: Session,
    source_id: int | None,
    event_type: str | None,
    from_ts: datetime | None,
    to_ts: datetime | None,
    limit: int,
    offset: int,
) -> EventListResponse:
    return event_service.list_events(
        db=db,
        source_id=source_id,
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
        offset=offset,
    )
