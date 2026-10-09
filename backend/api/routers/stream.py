from fastapi import APIRouter, Depends, WebSocket, status
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_capture_pool_ws, get_ws_user
from backend.controllers import stream_controller
from backend.controllers.stream_controller import StreamRejectedError
from backend.db.database import SessionLocal
from backend.db.models import User
from backend.services.capture_service import CapturePool

router = APIRouter(tags=["stream"])


def _start_stream(pool: CapturePool, camera_id: int, owner_id: int) -> None:
    # A short-lived session: the socket stays open for hours, the DB work takes milliseconds.
    db = SessionLocal()
    try:
        stream_controller.start_stream(db, pool, camera_id, owner_id)
    finally:
        db.close()


@router.websocket("/ws/cameras/{camera_id}/stream")
async def stream_camera(
    websocket: WebSocket,
    camera_id: int,
    current_user: User = Depends(get_ws_user),
    pool: CapturePool = Depends(get_capture_pool_ws),
) -> None:
    try:
        await run_in_threadpool(_start_stream, pool, camera_id, current_user.id)
    except StreamRejectedError as exc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(exc))
        return
    await websocket.send_text("ready")
    await stream_controller.relay_frames(websocket, pool, camera_id)
