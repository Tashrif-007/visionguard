from sqlalchemy.orm import Session

from backend.services import system_service


def get_status(db: Session) -> dict:
    return system_service.get_status(db)
