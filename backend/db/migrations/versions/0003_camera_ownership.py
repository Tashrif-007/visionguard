"""Camera ownership: every camera belongs to exactly one user.

Cameras (and, through camera_id, their events, zones and schedules) are private
to the user who registered them.

- cameras created before ownership was enforced (created_by IS NULL) are given
  to the seeded admin (the oldest admin, or the oldest user if there is none);
- created_by becomes NOT NULL and indexed;
- source_uri is unique per owner instead of globally, so two users can each
  register the same stream.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-06
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE cameras
        SET created_by = (SELECT id FROM users ORDER BY (role = 'admin') DESC, id LIMIT 1)
        WHERE created_by IS NULL
        """
    )
    op.alter_column("cameras", "created_by", existing_type=sa.Integer(), nullable=False)
    op.create_index("ix_cameras_created_by", "cameras", ["created_by"])
    op.drop_constraint("uq_cameras_source_uri", "cameras", type_="unique")
    op.create_unique_constraint("uq_cameras_owner_source_uri", "cameras", ["created_by", "source_uri"])


def downgrade() -> None:
    op.drop_constraint("uq_cameras_owner_source_uri", "cameras", type_="unique")
    op.create_unique_constraint("uq_cameras_source_uri", "cameras", ["source_uri"])
    op.drop_index("ix_cameras_created_by", table_name="cameras")
    op.alter_column("cameras", "created_by", existing_type=sa.Integer(), nullable=True)
