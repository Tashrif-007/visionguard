from datetime import datetime, time

from backend.services.camera_config import Schedule
from backend.services.schedule import is_armed

# 2026-10-05 is a Monday.
MON_NOON = datetime(2026, 10, 5, 12, 0)
MON_2330 = datetime(2026, 10, 5, 23, 30)
TUE_0100 = datetime(2026, 10, 6, 1, 0)


def _schedule(start: time, end: time, weekdays: set[int], enabled: bool = True) -> Schedule:
    return Schedule(enabled, frozenset(weekdays), start, end)


def test_no_schedule_is_always_armed() -> None:
    assert is_armed(MON_NOON, None)


def test_disabled_schedule_is_always_armed() -> None:
    assert is_armed(MON_NOON, _schedule(time(1), time(2), {0}, enabled=False))


def test_same_day_window() -> None:
    schedule = _schedule(time(9), time(17), {0})
    assert is_armed(MON_NOON, schedule)
    assert not is_armed(MON_2330, schedule)


def test_weekday_filter() -> None:
    assert not is_armed(MON_NOON, _schedule(time(9), time(17), {1}))


def test_overnight_window_spans_midnight() -> None:
    schedule = _schedule(time(22), time(6), {0})  # Monday night
    assert is_armed(MON_2330, schedule)
    assert is_armed(TUE_0100, schedule)  # still Monday's window
    assert not is_armed(MON_NOON, schedule)


def test_overnight_early_morning_belongs_to_previous_day() -> None:
    assert not is_armed(TUE_0100, _schedule(time(22), time(6), {1}))
