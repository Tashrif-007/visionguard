from fastapi import APIRouter, Depends, Response, UploadFile
from sqlalchemy.orm import Session

from backend.api.dependencies import get_capture_pool, get_current_user, get_db
from backend.controllers import camera_controller
from backend.db.models import User
from backend.schemas.camera import StartCameraRequest, VideoSourceRead
from backend.services.capture_service import CapturePool

router = APIRouter(tags=["camera"], dependencies=[Depends(get_current_user)])


@router.get("/cameras", response_model=list[VideoSourceRead])
def list_cameras(db: Session = Depends(get_db)) -> list[VideoSourceRead]:
    return camera_controller.list_active_cameras(db)


@router.post("/start-camera", response_model=VideoSourceRead)
def start_camera(
    request: StartCameraRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> VideoSourceRead:
    return camera_controller.start_camera(db=db, pool=pool, request=request, created_by=current_user.id)


@router.post("/stop-camera/{source_id}", response_model=VideoSourceRead)
def stop_camera(
    source_id: int,
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> VideoSourceRead:
    return camera_controller.stop_camera(db=db, pool=pool, source_id=source_id)


@router.post("/upload-video", response_model=VideoSourceRead)
def upload_video(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> VideoSourceRead:
    return camera_controller.upload_video(db=db, pool=pool, file=file, created_by=current_user.id)


@router.get("/frame/{source_id}")
def get_frame(source_id: int, pool: CapturePool = Depends(get_capture_pool)) -> Response:
    return Response(content=camera_controller.get_frame(pool, source_id), media_type="image/jpeg")
