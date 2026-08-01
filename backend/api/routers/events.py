from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db
from backend.controllers import event_controller
from backend.schemas.event import EventListResponse

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=EventListResponse)
def list_events(
    source_id: int | None = Query(default=None, description="Filter by video source"),
    event_type: str | None = Query(default=None, description="Filter by event type"),
    from_ts: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    to_ts: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> EventListResponse:
    return event_controller.get_events(
        db=db,
        source_id=source_id,
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
        offset=offset,
    )
