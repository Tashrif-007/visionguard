import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.database import Base, SessionLocal, engine
from backend.db.repositories import event_repository, user_repository, video_source_repository
from backend.api.routers import auth, camera, events, search, system, zones
from backend.models.tiny_cnn import load_tiny_cnn
from backend.services import auth_service, runtime_tuning
from backend.services.capture_service import CapturePool

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    runtime_tuning.configure_cpu_threads(settings.torch_num_threads, settings.cv_num_threads)

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")

    db = SessionLocal()
    try:
        video_source_repository.ensure_created_by_column(db)
        event_repository.ensure_roi_area_ratio_column(db)
        event_repository.ensure_clip_path_column(db)
        user_repository.ensure_is_active_column(db)
        user_repository.ensure_email_column(db)
        auth_service.seed_admin(db)
        stale = video_source_repository.deactivate_active_sources(db)
        if stale:
            logger.info("Deactivated %d stale active source(s) from previous run", stale)
    finally:
        db.close()

    app.state.capture_pool = CapturePool(model=load_tiny_cnn(settings.model_path))
    yield
    app.state.capture_pool.stop_all()


app = FastAPI(title="VisionGuard AI", version="0.1.0", lifespan=lifespan)

# Permissive CORS for local development UIs (the Vite dev server and any demo
# dashboard run on a different origin/port than this API).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(auth.router)
app.include_router(search.router)
app.include_router(events.router)
app.include_router(camera.router)
app.include_router(zones.router)
