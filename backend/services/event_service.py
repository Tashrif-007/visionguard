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
from backend.schemas.event import EventListResponse, EventRead
from backend.services.motion.roi import ROIBox

logger = logging.getLogger(__name__)


def log_motion_event(
    db: Session,
    source_id: int,
    frame: np.ndarray,
    bbox: ROIBox,
    frame_number: int | None,
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
        frame_number=frame_number,
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
