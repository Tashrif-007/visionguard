from datetime import datetime

from pydantic import BaseModel, Field, computed_field


class EventRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    camera_id: int
    event_type: str
    timestamp: datetime
    image_path: str
    roi_x: int
    roi_y: int
    roi_width: int
    roi_height: int
    roi_area_ratio: float | None
    frame_number: int | None
    clip_path: str | None = Field(default=None, exclude=True)
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_clip(self) -> bool:
        return self.clip_path is not None


class EventListResponse(BaseModel):
    events: list[EventRead]
    total: int


class EventFilterParams(BaseModel):
    camera_id: int | None = None
    event_type: str | None = None
    from_ts: datetime | None = None
    to_ts: datetime | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class DayCount(BaseModel):
    date: str
    count: int


class CameraCount(BaseModel):
    camera_id: int
    name: str
    count: int


class HeatmapCell(BaseModel):
    weekday: int  # 0=Mon .. 6=Sun
    hour: int  # 0..23, in the configured timezone
    count: int


class CoverageBucket(BaseModel):
    label: str
    count: int


class EventStatsResponse(BaseModel):
    total: int
    per_day: list[DayCount]
    per_camera: list[CameraCount]
    heatmap: list[HeatmapCell]
    coverage: list[CoverageBucket]
