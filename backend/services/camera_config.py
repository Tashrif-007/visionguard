from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class Zone:
    name: str
    mode: str  # "include" | "exclude"
    points: tuple[tuple[float, float], ...]  # normalized (x, y) in 0..1


@dataclass(frozen=True)
class Schedule:
    enabled: bool
    weekdays: frozenset[int]  # 0=Mon .. 6=Sun
    start_time: time
    end_time: time


@dataclass(frozen=True)
class CameraConfig:
    """Immutable per-camera detection settings, swapped atomically on update."""

    zones: tuple[Zone, ...] = ()
    schedule: Schedule | None = None
