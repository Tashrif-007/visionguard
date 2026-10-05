import logging
import os
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from backend.config import settings

logger = logging.getLogger(__name__)

# VP8 in WebM: browser-playable and encodable by OpenCV's bundled ffmpeg
# (H.264 isn't available in the pip wheel, and MPEG-4 Part 2 won't play in Chrome).
_FOURCC = "VP80"
CLIP_EXTENSION = ".webm"


@dataclass
class _ActiveClip:
    path: Path
    frames: list[np.ndarray]
    remaining: int


@dataclass(frozen=True)
class FinishedClip:
    path: Path
    frames: list[np.ndarray]


class ClipRecorder:
    """Keeps a short rolling buffer of recent frames and assembles event clips.

    Frames are sampled at `clip_fps` and downscaled, so the buffer stays small.
    `start_clip` snapshots the pre-roll; subsequent frames are appended until
    the post-roll is complete, at which point the clip is handed back for writing.
    """

    def __init__(self) -> None:
        self._interval = 1.0 / settings.clip_fps
        self._pre_frames = max(1, round(settings.clip_pre_seconds * settings.clip_fps))
        self._post_frames = max(1, round(settings.clip_post_seconds * settings.clip_fps))
        self._buffer: deque[np.ndarray] = deque(maxlen=self._pre_frames)
        self._active: list[_ActiveClip] = []
        self._last_sample = 0.0

    def start_clip(self) -> Path:
        path = Path(settings.clip_dir) / f"{_unique_name()}{CLIP_EXTENSION}"
        self._active.append(_ActiveClip(path, list(self._buffer), self._post_frames))
        return path

    def add_frame(self, frame: np.ndarray, now: float) -> list[FinishedClip]:
        if now - self._last_sample < self._interval:
            return []
        self._last_sample = now

        height, width = frame.shape[:2]
        if width > settings.clip_max_width:
            scale = settings.clip_max_width / width
            sample = cv2.resize(
                frame, (settings.clip_max_width, max(2, round(height * scale))), interpolation=cv2.INTER_AREA
            )
        else:
            sample = frame.copy()
        self._buffer.append(sample)

        finished: list[FinishedClip] = []
        still_active: list[_ActiveClip] = []
        for clip in self._active:
            clip.frames.append(sample)
            clip.remaining -= 1
            if clip.remaining <= 0:
                finished.append(FinishedClip(clip.path, clip.frames))
            else:
                still_active.append(clip)
        self._active = still_active
        return finished

    def flush(self) -> list[FinishedClip]:
        """Return clips still recording (source ended or stopped) so they aren't lost."""
        finished = [FinishedClip(c.path, c.frames) for c in self._active]
        self._active = []
        return finished


def _unique_name() -> str:
    return os.urandom(16).hex()


def write_clip(clip: FinishedClip) -> None:
    """Encode frames to disk; written under a temp name then renamed so readers never see a partial file."""
    if not clip.frames:
        return
    clip.path.parent.mkdir(parents=True, exist_ok=True)
    height, width = clip.frames[0].shape[:2]
    width -= width % 2
    height -= height % 2
    temp_path = clip.path.with_name(f"{clip.path.stem}.part{CLIP_EXTENSION}")
    writer = cv2.VideoWriter(
        str(temp_path), cv2.VideoWriter_fourcc(*_FOURCC), settings.clip_fps, (width, height)
    )
    if not writer.isOpened():
        logger.error("Could not open video writer for %s", temp_path)
        return
    try:
        for frame in clip.frames:
            writer.write(frame[:height, :width])
    finally:
        writer.release()
    os.replace(temp_path, clip.path)
    logger.info("Wrote event clip %s (%d frames)", clip.path, len(clip.frames))
