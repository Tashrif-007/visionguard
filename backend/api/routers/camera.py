from fastapi import APIRouter, Depends, Response, UploadFile, status
from sqlalchemy.orm import Session

from backend.api.dependencies import get_capture_pool, get_current_user, get_db
from backend.controllers import camera_controller
from backend.db.models import User
from backend.schemas.camera import CameraCreate, CameraRead, CameraUpdate
from backend.services.capture_service import CapturePool

router = APIRouter(tags=["camera"], dependencies=[Depends(get_current_user)])


@router.get("/cameras", response_model=list[CameraRead])
def list_cameras(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> list[CameraRead]:
    return camera_controller.list_cameras(db, pool, current_user.id)


@router.post("/cameras", response_model=CameraRead, status_code=status.HTTP_201_CREATED)
def register_camera(
    request: CameraCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraRead:
    return camera_controller.register_camera(db, pool, request, created_by=current_user.id)


@router.patch("/cameras/{camera_id}", response_model=CameraRead)
def update_camera(
    camera_id: int,
    request: CameraUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraRead:
    return camera_controller.update_camera(db, pool, camera_id, current_user.id, request)


@router.delete("/cameras/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(
    camera_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> None:
    camera_controller.delete_camera(db, pool, camera_id, current_user.id)


@router.post("/cameras/{camera_id}/start", response_model=CameraRead)
def start_camera(
    camera_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraRead:
    return camera_controller.start_camera(db, pool, camera_id, current_user.id)


@router.post("/cameras/{camera_id}/stop", response_model=CameraRead)
def stop_camera(
    camera_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraRead:
    return camera_controller.stop_camera(db, pool, camera_id, current_user.id)


@router.get("/cameras/{camera_id}/frame")
def get_frame(
    camera_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> Response:
    frame = camera_controller.get_frame(db, pool, camera_id, current_user.id)
    return Response(content=frame, media_type="image/jpeg")


@router.post("/upload-video", response_model=CameraRead, status_code=status.HTTP_201_CREATED)
def upload_video(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    pool: CapturePool = Depends(get_capture_pool),
) -> CameraRead:
    return camera_controller.upload_video(db, pool, file, created_by=current_user.id)
