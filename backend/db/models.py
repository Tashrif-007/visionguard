from datetime import datetime, time

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class VideoSource(Base):
    __tablename__ = "video_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_uri: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    events: Mapped[list["Event"]] = relationship("Event", back_populates="source")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("video_sources.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    roi_x: Mapped[int] = mapped_column(Integer, nullable=False)
    roi_y: Mapped[int] = mapped_column(Integer, nullable=False)
    roi_width: Mapped[int] = mapped_column(Integer, nullable=False)
    roi_height: Mapped[int] = mapped_column(Integer, nullable=False)
    roi_area_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    clip_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    source: Mapped["VideoSource"] = relationship("VideoSource", back_populates="events")

    __table_args__ = (
        Index("ix_events_source_timestamp", "source_id", "timestamp"),
        Index("ix_events_type_timestamp", "event_type", "timestamp"),
    )


class CameraZone(Base):
    __tablename__ = "camera_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("video_sources.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # "include" | "exclude"
    points: Mapped[list[list[float]]] = mapped_column(JSON, nullable=False)  # normalized [x, y] in 0..1
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


class CameraSchedule(Base):
    __tablename__ = "camera_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("video_sources.id"), nullable=False, unique=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    weekdays: Mapped[list[int]] = mapped_column(JSON, nullable=False)  # 0=Mon .. 6=Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
