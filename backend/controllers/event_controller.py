from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.schemas.event import EventListResponse, EventStatsResponse
from backend.services import event_service
from backend.services.event_service import EventNotFoundError


def get_event_snapshot(db: Session, event_id: int) -> bytes:
    try:
        return event_service.get_event_snapshot(db, event_id)
    except EventNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def get_event_clip_path(db: Session, event_id: int) -> Path:
    try:
        return event_service.get_event_clip_path(db, event_id)
    except EventNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def delete_event(db: Session, event_id: int) -> None:
    try:
        event_service.delete_event(db, event_id)
    except EventNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


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


def get_event_stats(
    db: Session, source_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> EventStatsResponse:
    return event_service.get_event_stats(db, source_id, from_ts, to_ts)
