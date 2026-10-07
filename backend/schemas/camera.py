from datetime import datetime

from pydantic import BaseModel, Field

from backend.services.camera_config import CameraStatus


class CameraCreate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    # Webcam index ("0"), stream URL or file path; defaults to VIDEO_SOURCE.
    source_uri: str | None = Field(default=None, min_length=1)


class CameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    source_uri: str | None = Field(default=None, min_length=1)


class CameraRead(BaseModel):
    id: int
    name: str
    source_type: str
    source_uri: str
    status: CameraStatus
    created_by: int
    created_at: datetime
