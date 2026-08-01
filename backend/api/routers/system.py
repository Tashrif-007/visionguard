from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db
from backend.controllers import system_controller

router = APIRouter(prefix="/system", tags=["system"], dependencies=[Depends(get_current_user)])


@router.get("/status")
def system_status(db: Session = Depends(get_db)) -> dict:
    return system_controller.get_status(db)
