import numpy as np

from backend.services.camera_config import Zone
from backend.services.motion.zones import build_zone_mask

SHAPE = (100, 200)
LEFT_HALF = ((0.0, 0.0), (0.5, 0.0), (0.5, 1.0), (0.0, 1.0))


def test_no_zones_returns_none() -> None:
    assert build_zone_mask(SHAPE, ()) is None


def test_include_only_restricts_to_zone() -> None:
    mask = build_zone_mask(SHAPE, (Zone("left", "include", LEFT_HALF),))
    assert mask is not None
    assert mask[50, 20] == 255
    assert mask[50, 180] == 0


def test_exclude_only_removes_zone_from_full_frame() -> None:
    mask = build_zone_mask(SHAPE, (Zone("left", "exclude", LEFT_HALF),))
    assert mask is not None
    assert mask[50, 20] == 0
    assert mask[50, 180] == 255


def test_exclude_cuts_hole_in_include() -> None:
    whole = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    mask = build_zone_mask(SHAPE, (Zone("all", "include", whole), Zone("left", "exclude", LEFT_HALF)))
    assert mask is not None
    assert mask[50, 20] == 0
    assert mask[50, 180] == 255


def test_mask_applied_to_motion_blocks_outside_motion() -> None:
    motion = np.zeros(SHAPE, np.uint8)
    motion[40:60, 150:190] = 255  # motion on the right
    mask = build_zone_mask(SHAPE, (Zone("left", "include", LEFT_HALF),))
    assert mask is not None
    assert not (motion & mask).any()
