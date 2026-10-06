from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import Camera


def create_camera(
    db: Session, name: str, source_type: str, source_uri: str, created_by: int
) -> Camera:
    camera = Camera(name=name, source_type=source_type, source_uri=source_uri, created_by=created_by)
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


def get_by_id(db: Session, camera_id: int, owner_id: int) -> Camera | None:
    """The owner's camera that has not been deleted (someone else's camera counts as missing)."""
    camera = db.get(Camera, camera_id)
    if camera is None or camera.deleted_at is not None or camera.created_by != owner_id:
        return None
    return camera


def get_by_uri(db: Session, source_uri: str, owner_id: int) -> Camera | None:
    """The owner's camera with this URI, including a deleted one (unique per owner)."""
    stmt = select(Camera).where(Camera.source_uri == source_uri, Camera.created_by == owner_id)
    return db.execute(stmt).scalar_one_or_none()


def list_cameras(db: Session, owner_id: int) -> list[Camera]:
    stmt = (
        select(Camera)
        .where(Camera.created_by == owner_id, Camera.deleted_at.is_(None))
        .order_by(Camera.name, Camera.id)
    )
    return list(db.execute(stmt).scalars().all())


def update_camera(db: Session, camera: Camera, name: str, source_uri: str, source_type: str) -> Camera:
    camera.name = name
    camera.source_uri = source_uri
    camera.source_type = source_type
    db.commit()
    db.refresh(camera)
    return camera


def soft_delete(db: Session, camera: Camera) -> None:
    camera.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()


def delete_camera(db: Session, camera: Camera) -> None:
    """Hard delete — only for a camera that never produced events."""
    db.delete(camera)
    db.commit()


def restore(db: Session, camera: Camera, name: str, source_type: str) -> Camera:
    """Bring back a deleted camera when its URI is registered again."""
    camera.deleted_at = None
    camera.name = name
    camera.source_type = source_type
    db.commit()
    db.refresh(camera)
    return camera
