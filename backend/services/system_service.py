from sqlalchemy import text
from sqlalchemy.orm import Session


def get_status(db: Session) -> dict:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok",
        "database": db_status,
        "pipeline": "idle",
    }
