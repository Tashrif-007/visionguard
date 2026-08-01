from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from backend.db.models import VideoSource


def create_source(
    db: Session,
    name: str,
    source_type: str,
    source_uri: str,
    is_active: bool,
    created_by: int | None = None,
) -> VideoSource:
    source = VideoSource(
        name=name,
        source_type=source_type,
        source_uri=source_uri,
        is_active=is_active,
        created_by=created_by,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def ensure_created_by_column(db: Session) -> None:
    """Idempotently add video_sources.created_by.

    Base.metadata.create_all only creates missing tables, never adds columns
    to a table that already exists — video_sources predates the users table.
    """
    db.execute(
        text("ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)")
    )
    db.commit()


def get_by_id(db: Session, source_id: int) -> VideoSource | None:
    return db.get(VideoSource, source_id)


def get_active_sources(db: Session) -> list[VideoSource]:
    stmt = select(VideoSource).where(VideoSource.is_active.is_(True)).order_by(VideoSource.id)
    return list(db.execute(stmt).scalars().all())


def deactivate_source(db: Session, source_id: int) -> None:
    stmt = update(VideoSource).where(VideoSource.id == source_id).values(is_active=False)
    db.execute(stmt)
    db.commit()


def deactivate_active_sources(db: Session) -> int:
    """Deactivate every active source — used once at startup to clear stale
    rows left over from a previous run's crash, before any capture pool exists."""
    stmt = update(VideoSource).where(VideoSource.is_active.is_(True)).values(is_active=False)
    result = db.execute(stmt)
    db.commit()
    return result.rowcount
