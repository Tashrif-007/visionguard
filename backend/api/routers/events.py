from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, require_admin
from backend.controllers import event_controller
from backend.schemas.event import EventListResponse, EventStatsResponse

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])


@router.get("/stats", response_model=EventStatsResponse)
def get_event_stats(
    source_id: int | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    to_ts: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    db: Session = Depends(get_db),
) -> EventStatsResponse:
    return event_controller.get_event_stats(db, source_id, from_ts, to_ts)


@router.get("/{event_id}/snapshot")
def get_event_snapshot(event_id: int, db: Session = Depends(get_db)) -> Response:
    return Response(content=event_controller.get_event_snapshot(db, event_id), media_type="image/jpeg")


@router.get("/{event_id}/clip")
def get_event_clip(event_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return FileResponse(event_controller.get_event_clip_path(db, event_id), media_type="video/webm")


@router.delete("/{event_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_event(event_id: int, db: Session = Depends(get_db)) -> None:
    event_controller.delete_event(db, event_id)


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
