import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import Event
from backend.db.repositories import event_repository
from backend.schemas.event import (
    CameraCount,
    CoverageBucket,
    DayCount,
    EventListResponse,
    EventRead,
    EventStatsResponse,
    HeatmapCell,
)
from backend.services.motion.roi import ROIBox

logger = logging.getLogger(__name__)


class EventNotFoundError(Exception):
    """Raised when an event id doesn't exist or its snapshot file is missing."""


def log_motion_event(
    db: Session,
    source_id: int,
    frame: np.ndarray,
    bbox: ROIBox,
    frame_number: int | None,
    clip_path: str | None = None,
) -> Event:
    snapshot_dir = Path(settings.snapshot_dir)
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    image_path = snapshot_dir / f"{uuid.uuid4().hex}.jpg"
    if not cv2.imwrite(str(image_path), frame):
        raise OSError(f"Failed to write snapshot to {image_path}")

    event = event_repository.create_event(
        db=db,
        source_id=source_id,
        event_type="motion",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
        image_path=str(image_path),
        roi_x=bbox.x,
        roi_y=bbox.y,
        roi_width=bbox.width,
        roi_height=bbox.height,
        roi_area_ratio=round(bbox.width * bbox.height / (frame.shape[0] * frame.shape[1]), 4),
        frame_number=frame_number,
        clip_path=clip_path,
    )
    logger.info("Logged motion event id=%d source=%d roi=%s", event.id, source_id, bbox)
    return event


def list_events(
    db: Session,
    source_id: int | None,
    event_type: str | None,
    from_ts: datetime | None,
    to_ts: datetime | None,
    limit: int,
    offset: int,
) -> EventListResponse:
    events, total = event_repository.get_events(
        db=db,
        source_id=source_id,
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
        offset=offset,
    )
    return EventListResponse(
        events=[EventRead.model_validate(e) for e in events],
        total=total,
    )


def get_event_snapshot(db: Session, event_id: int) -> bytes:
    event = event_repository.get_event_by_id(db, event_id)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} not found")

    snapshot_root = Path(settings.snapshot_dir).resolve()
    image_path = Path(event.image_path).resolve()
    # image_path already includes the snapshot_dir prefix baked in at write
    # time (see log_motion_event above) — do not join settings.snapshot_dir
    # again here. is_relative_to() guards against path traversal even though
    # image_path is always server-generated (uuid filenames), not user input.
    if not image_path.is_relative_to(snapshot_root) or not image_path.is_file():
        raise EventNotFoundError(f"Snapshot for event {event_id} not found")

    return image_path.read_bytes()


def get_event_clip_path(db: Session, event_id: int) -> Path:
    event = event_repository.get_event_by_id(db, event_id)
    if event is None or event.clip_path is None:
        raise EventNotFoundError(f"Event {event_id} has no clip")

    clip_root = Path(settings.clip_dir).resolve()
    clip_path = Path(event.clip_path).resolve()
    # Same traversal guard as snapshots. A missing file means the clip is still
    # being recorded (or failed to encode).
    if not clip_path.is_relative_to(clip_root) or not clip_path.is_file():
        raise EventNotFoundError(f"Clip for event {event_id} is not available yet")
    return clip_path


def delete_event(db: Session, event_id: int) -> None:
    event = event_repository.get_event_by_id(db, event_id)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} not found")

    # Best-effort: the DB row is the source of truth, so a missing/already-gone
    # snapshot file shouldn't block deleting the event record itself.
    image_path = Path(event.image_path)
    try:
        image_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not remove snapshot file %s for event %d", image_path, event_id)

    if event.clip_path is not None:
        try:
            Path(event.clip_path).unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove clip file %s for event %d", event.clip_path, event_id)

    event_repository.delete_event(db, event)
    logger.info("Deleted event id=%d", event_id)


def get_event_stats(
    db: Session, source_id: int | None, from_ts: datetime | None, to_ts: datetime | None
) -> EventStatsResponse:
    tz = settings.schedule_timezone
    per_day = event_repository.count_per_day(db, tz, source_id, from_ts, to_ts)
    coverage = dict(event_repository.count_coverage(db, source_id, from_ts, to_ts))
    labels = [label for label, _ in event_repository.COVERAGE_BUCKETS] + ["unknown"]
    return EventStatsResponse(
        total=sum(n for _, n in per_day),
        per_day=[DayCount(date=d, count=n) for d, n in per_day],
        per_camera=[
            CameraCount(source_id=sid, name=name, count=n)
            for sid, name, n in event_repository.count_per_camera(db, source_id, from_ts, to_ts)
        ],
        heatmap=[
            HeatmapCell(weekday=w, hour=h, count=n)
            for w, h, n in event_repository.count_heatmap(db, tz, source_id, from_ts, to_ts)
        ],
        coverage=[CoverageBucket(label=label, count=coverage.get(label, 0)) for label in labels],
    )
