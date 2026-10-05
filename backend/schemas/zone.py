from datetime import time

from pydantic import BaseModel, Field


class ZoneWrite(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    mode: str = Field(pattern="^(include|exclude)$")
    points: list[list[float]] = Field(min_length=3, max_length=64)


class ZoneRead(ZoneWrite):
    id: int


class ScheduleWrite(BaseModel):
    enabled: bool = True
    weekdays: list[int] = Field(min_length=1, max_length=7)
    start_time: time
    end_time: time


class ScheduleRead(ScheduleWrite):
    pass


class CameraConfigRead(BaseModel):
    source_id: int
    zones: list[ZoneRead]
    schedule: ScheduleRead | None
    armed: bool
