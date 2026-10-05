from datetime import datetime
from zoneinfo import ZoneInfo

from backend.services.camera_config import Schedule


def is_armed(now: datetime, schedule: Schedule | None) -> bool:
    """True when detection should run at `now` (a timezone-aware or local naive datetime).

    No schedule, or a disabled one, means always armed. A window whose end is
    earlier than its start (e.g. 22:00-06:00) spans midnight and belongs to the
    weekday it *starts* on.
    """
    if schedule is None or not schedule.enabled:
        return True

    current = now.time()
    start, end = schedule.start_time, schedule.end_time
    weekday = now.weekday()

    if start <= end:
        return weekday in schedule.weekdays and start <= current < end
    if current >= start:
        return weekday in schedule.weekdays
    return (weekday - 1) % 7 in schedule.weekdays and current < end


def now_in_timezone(timezone_name: str) -> datetime:
    return datetime.now(ZoneInfo(timezone_name))
