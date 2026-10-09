import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from backend.config import settings
from backend.services import camera_service
from backend.services.camera_service import CameraBusyError, CameraSourceError
from backend.services.capture_service import CaptureError, CapturePool
from backend.services.zone_service import CameraNotFoundError

logger = logging.getLogger(__name__)

_START_ERRORS = (CameraNotFoundError, CameraBusyError, CameraSourceError, CaptureError)


class StreamRejectedError(Exception):
    """Raised when a browser camera stream cannot be opened; the message is sent as the close reason."""


def start_stream(db: Session, pool: CapturePool, camera_id: int, owner_id: int) -> None:
    try:
        camera_service.start_browser_camera(db, pool, camera_id, owner_id)
    except _START_ERRORS as exc:
        raise StreamRejectedError(str(exc)) from exc


async def relay_frames(websocket: WebSocket, pool: CapturePool, camera_id: int) -> None:
    """Feed the JPEG frames a browser sends into the camera's capture until either side stops.

    Ends when the browser disconnects, goes silent for the idle timeout, sends an
    oversized frame, or the camera is stopped elsewhere (e.g. POST /stop). The
    camera is always stopped on the way out so a dead tab never leaves it "running".
    """
    try:
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive(), timeout=settings.browser_stream_idle_timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.info("Browser camera id=%d sent no frames — closing", camera_id)
                await websocket.close(code=status.WS_1001_GOING_AWAY, reason="No frames received")
                return
            if message["type"] == "websocket.disconnect":
                return
            data = message.get("bytes")
            if data is None:
                continue
            if len(data) > settings.browser_stream_max_frame_bytes:
                await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG, reason="Frame too large")
                return
            if not await run_in_threadpool(pool.push_jpeg, camera_id, data):
                await websocket.close(code=status.WS_1000_NORMAL_CLOSURE, reason="Camera stopped")
                return
    except WebSocketDisconnect:
        return
    finally:
        await run_in_threadpool(pool.stop, camera_id)
