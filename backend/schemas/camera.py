from datetime import datetime

from pydantic import BaseModel


class StartCameraRequest(BaseModel):
    name: str | None = None
    source_uri: str | None = None


class VideoSourceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    source_type: str
    source_uri: str
    is_active: bool
    created_by: int | None = None
    created_at: datetime
