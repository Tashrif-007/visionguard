from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


class Base(DeclarativeBase):
    pass


def run_migrations() -> None:
    """Bring the database schema up to date (same as `alembic upgrade head`)."""
    config = Config(str(_ALEMBIC_INI))
    config.attributes["configure_logger"] = False  # keep the app's logging setup
    command.upgrade(config, "head")
