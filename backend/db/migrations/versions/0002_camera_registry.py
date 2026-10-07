"""Camera registry: replace per-start video_sources rows with persistent cameras.

Before: every start inserted a new video_sources row, so one physical camera
was split across many ids. After: one `cameras` row per source URI; events,
zones and schedules point at it, and running state lives only in memory.

Data migration:
- one camera per distinct video_sources.source_uri, keeping the id, name,
  type and creator of the newest row for that URI and the oldest created_at;
- events are re-pointed to their URI's camera (no events are lost);
- zones/schedules: the newest source that had them wins (the same rule the old
  "inherit config on re-add" code used); older duplicates are dropped.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# video_sources.id -> cameras.id, matched on source_uri.
_SOURCE_TO_CAMERA = "SELECT v.id AS source_id, c.id AS camera_id FROM video_sources v JOIN cameras c USING (source_uri)"


def _repoint(table: str) -> None:
    op.add_column(table, sa.Column("camera_id", sa.Integer(), nullable=True))
    op.execute(
        f"UPDATE {table} t SET camera_id = m.camera_id FROM ({_SOURCE_TO_CAMERA}) m WHERE t.source_id = m.source_id"
    )


def _keep_newest_source_per_camera(table: str) -> None:
    op.execute(
        f"""
        DELETE FROM {table} t
        WHERE t.source_id <> (SELECT max(t2.source_id) FROM {table} t2 WHERE t2.camera_id = t.camera_id)
        """
    )


def upgrade() -> None:
    op.create_table(
        "cameras",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("source_uri", name="uq_cameras_source_uri"),
    )
    op.execute(
        """
        INSERT INTO cameras (id, name, source_type, source_uri, created_by, created_at)
        SELECT DISTINCT ON (v.source_uri)
               v.id, v.name, v.source_type, v.source_uri, v.created_by,
               min(v.created_at) OVER (PARTITION BY v.source_uri)
        FROM video_sources v
        ORDER BY v.source_uri, v.id DESC
        """
    )
    op.execute("SELECT setval(pg_get_serial_sequence('cameras', 'id'), coalesce(max(id), 0) + 1, false) FROM cameras")

    _repoint("events")
    op.alter_column("events", "camera_id", nullable=False)
    op.create_foreign_key("events_camera_id_fkey", "events", "cameras", ["camera_id"], ["id"])
    op.drop_index("ix_events_source_timestamp", table_name="events")
    op.drop_column("events", "source_id")
    op.create_index("ix_events_camera_timestamp", "events", ["camera_id", "timestamp"])

    _repoint("camera_zones")
    _keep_newest_source_per_camera("camera_zones")
    op.alter_column("camera_zones", "camera_id", nullable=False)
    op.create_foreign_key("camera_zones_camera_id_fkey", "camera_zones", "cameras", ["camera_id"], ["id"])
    op.drop_index("ix_camera_zones_source_id", table_name="camera_zones")
    op.drop_column("camera_zones", "source_id")
    op.create_index("ix_camera_zones_camera_id", "camera_zones", ["camera_id"])

    _repoint("camera_schedules")
    _keep_newest_source_per_camera("camera_schedules")
    op.alter_column("camera_schedules", "camera_id", nullable=False)
    op.create_foreign_key("camera_schedules_camera_id_fkey", "camera_schedules", "cameras", ["camera_id"], ["id"])
    op.drop_column("camera_schedules", "source_id")
    op.create_unique_constraint("camera_schedules_camera_id_key", "camera_schedules", ["camera_id"])

    op.drop_table("video_sources")


def downgrade() -> None:
    # One video_sources row per camera, reusing the camera id. Per-start
    # history merged by upgrade() cannot be restored; soft-deleted cameras
    # come back as ordinary inactive sources.
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
    op.execute(
        """
        INSERT INTO video_sources (id, name, source_type, source_uri, is_active, created_by, created_at)
        SELECT id, name, source_type, source_uri, false, created_by, created_at FROM cameras
        """
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('video_sources', 'id'), coalesce(max(id), 0) + 1, false) FROM video_sources"
    )

    for table, index in (("events", None), ("camera_zones", "ix_camera_zones_source_id"), ("camera_schedules", None)):
        op.add_column(table, sa.Column("source_id", sa.Integer(), nullable=True))
        op.execute(f"UPDATE {table} SET source_id = camera_id")
        op.alter_column(table, "source_id", nullable=False)
        op.create_foreign_key(f"{table}_source_id_fkey", table, "video_sources", ["source_id"], ["id"])
        if index is not None:
            op.create_index(index, table, ["source_id"])

    op.drop_index("ix_events_camera_timestamp", table_name="events")
    op.drop_column("events", "camera_id")
    op.create_index("ix_events_source_timestamp", "events", ["source_id", "timestamp"])

    op.drop_index("ix_camera_zones_camera_id", table_name="camera_zones")
    op.drop_column("camera_zones", "camera_id")

    op.drop_column("camera_schedules", "camera_id")
    op.create_unique_constraint("camera_schedules_source_id_key", "camera_schedules", ["source_id"])

    op.drop_table("cameras")
