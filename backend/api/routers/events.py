from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, require_admin
from backend.controllers import event_controller
from backend.db.models import User
from backend.schemas.event import EventListResponse, EventStatsResponse

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])


@router.get("/stats", response_model=EventStatsResponse)
def get_event_stats(
    camera_id: int | None = Query(default=None),
    from_ts: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    to_ts: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventStatsResponse:
    return event_controller.get_event_stats(db, current_user.id, camera_id, from_ts, to_ts)


@router.get("/{event_id}/snapshot")
def get_event_snapshot(
    event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    content = event_controller.get_event_snapshot(db, event_id, current_user.id)
    return Response(content=content, media_type="image/jpeg")


@router.get("/{event_id}/clip")
def get_event_clip(
    event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> FileResponse:
    clip_path = event_controller.get_event_clip_path(db, event_id, current_user.id)
    return FileResponse(clip_path, media_type="video/webm")


@router.delete("/{event_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_event(
    event_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    event_controller.delete_event(db, event_id, current_user.id)


@router.get("", response_model=EventListResponse)
def list_events(
    camera_id: int | None = Query(default=None, description="Filter by camera"),
    event_type: str | None = Query(default=None, description="Filter by event type"),
    from_ts: datetime | None = Query(default=None, description="Start of time range (ISO 8601)"),
    to_ts: datetime | None = Query(default=None, description="End of time range (ISO 8601)"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventListResponse:
    return event_controller.get_events(
        db=db,
        owner_id=current_user.id,
        camera_id=camera_id,
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
        offset=offset,
    )
