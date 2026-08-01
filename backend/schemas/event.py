from datetime import datetime

from pydantic import BaseModel, Field


class EventRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    source_id: int
    event_type: str
    timestamp: datetime
    image_path: str
    roi_x: int
    roi_y: int
    roi_width: int
    roi_height: int
    frame_number: int | None
    created_at: datetime


class EventListResponse(BaseModel):
    events: list[EventRead]
    total: int


class EventFilterParams(BaseModel):
    source_id: int | None = None
    event_type: str | None = None
    from_ts: datetime | None = None
    to_ts: datetime | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
