"""Baseline: the schema as it was before Alembic was introduced.

On an empty database this creates every table. On a database created by the
old `create_all()` + `ensure_*_column()` startup code (tables already exist but
there is no alembic_version yet), it only adds the columns those helpers used
to add, so both kinds of database end up at the same baseline.

Revision ID: 0001
Revises:
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _bring_legacy_schema_to_baseline() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true")
    op.execute("ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)")
    op.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS roi_area_ratio DOUBLE PRECISION")
    op.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS clip_path TEXT")


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("users"):
        _bring_legacy_schema_to_baseline()
        return

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "video_sources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("video_sources.id"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("image_path", sa.Text(), nullable=False),
        sa.Column("roi_x", sa.Integer(), nullable=False),
        sa.Column("roi_y", sa.Integer(), nullable=False),
        sa.Column("roi_width", sa.Integer(), nullable=False),
        sa.Column("roi_height", sa.Integer(), nullable=False),
        sa.Column("roi_area_ratio", sa.Float(), nullable=True),
        sa.Column("clip_path", sa.Text(), nullable=True),
        sa.Column("frame_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_events_source_timestamp", "events", ["source_id", "timestamp"])
    op.create_index("ix_events_type_timestamp", "events", ["event_type", "timestamp"])

    op.create_table(
        "camera_zones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("video_sources.id"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("points", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_camera_zones_source_id", "camera_zones", ["source_id"])

    op.create_table(
        "camera_schedules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("video_sources.id"), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("weekdays", sa.JSON(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("camera_schedules")
    op.drop_table("camera_zones")
    op.drop_table("events")
    op.drop_table("video_sources")
    op.drop_table("users")
