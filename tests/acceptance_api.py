"""Black-box API acceptance run against a live backend and real PostgreSQL.

Not collected by pytest (no ``test_`` prefix) because it needs a running server:

    uvicorn backend.main:app --port 8000
    venv/bin/python tests/acceptance_api.py --out acceptance_results.json

It creates synthetic videos, drives the public HTTP API, and records the
expected and actual outcome of every case. It creates a QA operator account
(deactivated again at the end) and a few video sources/events.
"""

import argparse
import json
import logging
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import httpx
import numpy as np

logger = logging.getLogger("acceptance")
FRAME_SIZE = (640, 360)
FPS = 30


@dataclass
class Result:
    case_id: str
    title: str
    expected: str
    actual: str
    passed: bool


results: list[Result] = []


def record(case_id: str, title: str, expected: str, actual: str, passed: bool) -> None:
    results.append(Result(case_id, title, expected, actual, passed))
    logger.info("%s %s -> %s (%s)", case_id, title, "PASS" if passed else "FAIL", actual)


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def write_video(path: Path, kind: str, seconds: int = 20) -> None:
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, FRAME_SIZE)
    rng = np.random.default_rng(0)
    background = (rng.random((FRAME_SIZE[1], FRAME_SIZE[0], 3)) * 40 + 100).astype(np.uint8)
    for i in range(seconds * FPS):
        frame = background.copy()
        if kind == "moving":
            x = 420 + int(80 * np.sin(i / 15))
            cv2.rectangle(frame, (x, 120), (x + 60, 200), (255, 255, 255), -1)
        elif kind == "flicker" and i % 90 < 6:  # a 6-frame blip every 3 s
            cv2.rectangle(frame, (400, 120), (460, 200), (255, 255, 255), -1)
        writer.write(frame)
    writer.release()


class Api:
    def __init__(self, base_url: str) -> None:
        self.client = httpx.Client(base_url=base_url, timeout=30.0)
        self.token = ""

    def login(self, email: str, password: str) -> httpx.Response:
        return self.client.post("/auth/login", json={"email": email, "password": password})

    def use_token(self, token: str) -> None:
        self.token = token

    def request(self, method: str, url: str, token: str | None = None, **kwargs) -> httpx.Response:  # type: ignore[no-untyped-def]
        headers = {"Authorization": f"Bearer {token if token is not None else self.token}"}
        return self.client.request(method, url, headers=headers, **kwargs)

    def upload(self, path: Path) -> int:
        with path.open("rb") as handle:
            response = self.request("POST", "/upload-video", files={"file": (path.name, handle, "video/mp4")})
        response.raise_for_status()
        return int(response.json()["id"])

    def register(self, name: str, source_uri: str) -> int:
        response = self.request("POST", "/cameras", json={"name": name, "source_uri": source_uri})
        response.raise_for_status()
        return int(response.json()["id"])

    def events(self, camera_id: int, **params) -> dict:  # type: ignore[no-untyped-def,type-arg]
        return self.request("GET", "/events", params={"camera_id": camera_id, "limit": 200, **params}).json()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--env", default=".env")
    parser.add_argument("--out", default="acceptance_results.json")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    env = read_env(Path(args.env))
    api = Api(args.base_url)
    work = Path(tempfile.mkdtemp(prefix="vg_acceptance_"))
    suffix = uuid.uuid4().hex[:6]

    # ---------------------------------------------------------------- auth
    r = api.login(env["ADMIN_EMAIL"], env["ADMIN_PASSWORD"])
    ok = r.status_code == 200 and "access_token" in r.json()
    record("TC-01", "Admin login with valid credentials", "200 and a JWT access token", f"{r.status_code}, token issued={ok}", ok)
    admin_token = r.json()["access_token"]
    api.use_token(admin_token)

    r = api.login(env["ADMIN_EMAIL"], "definitely-wrong-password")
    record("TC-02", "Login with a wrong password", "401, no token", f"{r.status_code}", r.status_code == 401)

    r = api.client.get("/events")
    record("TC-03", "Protected route without a token", "401 before any controller logic", f"{r.status_code}", r.status_code in (401, 403))

    qa_email = f"qa.operator.{suffix}@example.com"
    qa_password = "QaPassw0rd!"
    r = api.request("POST", "/auth/users", json={"name": "QA Operator", "email": qa_email, "password": qa_password, "role": "operator"})
    created = r.status_code in (200, 201)
    qa_id = r.json().get("id") if created else None
    record("TC-04", "Admin creates an operator account", "200/201 with role operator", f"{r.status_code}, role={r.json().get('role') if created else None}", created)

    twin = api.request("POST", "/auth/users", json={"name": "QA Operator", "email": f"qa.twin.{suffix}@example.com", "password": qa_password, "role": "operator"})
    twin_id = twin.json().get("id") if twin.status_code in (200, 201) else None
    record("TC-05", "Two accounts may share a display name", "200/201 (email is the unique key, not the name)", f"{twin.status_code}", twin_id is not None)

    r = api.login(qa_email, qa_password)
    op_token = r.json().get("access_token", "") if r.status_code == 200 else ""
    r2 = api.request("POST", "/auth/users", token=op_token, json={"name": "X", "email": f"x.{suffix}@example.com", "password": "Another1!", "role": "operator"})
    record("TC-06", "Operator cannot create accounts", "403, no account created", f"{r2.status_code}", r2.status_code == 403)

    r = api.request("DELETE", "/events/1", token=op_token)
    record("TC-07", "Operator cannot delete events", "403", f"{r.status_code}", r.status_code == 403)

    r = api.request("PATCH", "/auth/password", token=op_token, json={"current_password": "wrong-current", "new_password": "NewPassw0rd!"})
    record("TC-08", "Change password with a wrong current password", "Rejected (4xx), password unchanged", f"{r.status_code}", 400 <= r.status_code < 500)
    r = api.request("PATCH", "/auth/password", token=op_token, json={"current_password": qa_password, "new_password": "NewPassw0rd!"})
    relog = api.login(qa_email, "NewPassw0rd!")
    record("TC-09", "Change password with the correct current password", "2xx, and the new password logs in", f"{r.status_code}, relogin={relog.status_code}", r.status_code < 300 and relog.status_code == 200)

    r = api.request("PATCH", f"/auth/users/{qa_id}/status", json={"is_active": False})
    blocked = api.login(qa_email, "NewPassw0rd!")
    record("TC-10", "Deactivated account cannot sign in", "401 on login after deactivation", f"deactivate={r.status_code}, login={blocked.status_code}", blocked.status_code == 401)

    me = api.request("GET", "/auth/me").json()
    r = api.request("PATCH", f"/auth/users/{me['id']}/status", json={"is_active": False})
    record("TC-11", "Admin cannot deactivate own account", "Rejected (4xx)", f"{r.status_code}", 400 <= r.status_code < 500)

    # --------------------------------------------------------------- cameras
    bad_cam = api.register("bad", f"/nonexistent/video_{suffix}.mp4")
    r = api.request("POST", f"/cameras/{bad_cam}/start")
    bad_status = next(c["status"] for c in api.request("GET", "/cameras").json() if c["id"] == bad_cam)
    record("TC-12", "Start a camera with an unreachable source", "400 with a clear message, camera stays stopped", f"{r.status_code}: {r.json().get('detail')}; status={bad_status}", r.status_code == 400 and bad_status == "stopped")

    r = api.request("POST", "/cameras", json={"name": "bad twin", "source_uri": f"/nonexistent/video_{suffix}.mp4"})
    record("TC-38", "Register a second camera with the same source URI", "409, no duplicate camera", f"{r.status_code}: {r.json().get('detail')}", r.status_code == 409)

    bad_file = work / "notes.txt"
    bad_file.write_text("this is not a video")
    with bad_file.open("rb") as handle:
        r = api.request("POST", "/upload-video", files={"file": ("notes.txt", handle, "text/plain")})
    record("TC-13", "Upload a non-video file", "400 validation error", f"{r.status_code}", r.status_code == 400)

    r = api.request("POST", "/cameras/999999/stop")
    record("TC-14", "Stop a camera that does not exist", "404, no unhandled error", f"{r.status_code}", r.status_code == 404)

    # synthetic scenarios: all started together so they run in parallel
    videos = {}
    for kind in ("static", "flicker", "moving"):
        videos[kind] = work / f"{kind}.mp4"
        write_video(videos[kind], kind)

    src_static = api.upload(videos["static"])
    src_flicker = api.upload(videos["flicker"])
    src_base = api.upload(videos["moving"])
    src_exclude = api.upload(videos["moving"])
    src_include_elsewhere = api.upload(videos["moving"])
    src_include_hit = api.upload(videos["moving"])
    src_disarmed = api.upload(videos["moving"])

    right_half = [[0.5, 0.0], [1.0, 0.0], [1.0, 1.0], [0.5, 1.0]]
    left_half = [[0.0, 0.0], [0.5, 0.0], [0.5, 1.0], [0.0, 1.0]]
    api.request("PUT", f"/cameras/{src_exclude}/zones", json=[{"name": "right", "mode": "exclude", "points": right_half}])
    api.request("PUT", f"/cameras/{src_include_elsewhere}/zones", json=[{"name": "left", "mode": "include", "points": left_half}])
    api.request("PUT", f"/cameras/{src_include_hit}/zones", json=[{"name": "right", "mode": "include", "points": right_half}])
    r_sched = api.request("PUT", f"/cameras/{src_disarmed}/schedule", json={"enabled": True, "weekdays": [0, 1, 2, 3, 4, 5, 6], "start_time": "03:00:00", "end_time": "03:01:00"})

    frame = api.request("GET", f"/cameras/{src_base}/frame")
    record("TC-15", "Upload a valid video and fetch a processed frame", "Upload 201; /cameras/{id}/frame returns a JPEG", f"frame={frame.status_code} {frame.headers.get('content-type')} {len(frame.content)} bytes", frame.status_code == 200 and frame.headers.get("content-type") == "image/jpeg")

    time.sleep(26)

    n_static = api.events(src_static)["total"]
    record("TC-16", "Static scene: no motion, no events", "0 events", f"{n_static} events", n_static == 0)

    n_flicker = api.events(src_flicker)["total"]
    record("TC-17", "Motion shorter than MOTION_MIN_FRAMES is ignored", "0 events for a 6-frame blip repeated every 3 s", f"{n_flicker} events", n_flicker == 0)

    base = api.events(src_base)
    events = base["events"]
    ok = base["total"] >= 1 and all(e["roi_width"] > 0 and e["roi_height"] > 0 for e in events)
    record("TC-18", "Moving object logs events with ROI geometry", ">= 1 event; ROI width/height > 0", f"{base['total']} events; first ROI={events[0]['roi_width']}x{events[0]['roi_height']}" if events else "0 events", ok)

    ratios_ok = bool(events) and all(e["roi_area_ratio"] is not None and 0 < e["roi_area_ratio"] < 1 for e in events)
    record("TC-19", "Each event stores its ROI area ratio", "roi_area_ratio in (0, 1) on every event", f"ratios={[e['roi_area_ratio'] for e in events[:3]]}", ratios_ok)

    stamps = sorted(time.mktime(time.strptime(e["timestamp"].split(".")[0], "%Y-%m-%dT%H:%M:%S")) for e in events)
    gaps = [b - a for a, b in zip(stamps, stamps[1:])]
    cooldown = float(env.get("EVENT_COOLDOWN_SECONDS", "5.0"))
    record("TC-20", "Event cooldown throttles logging", f"Gap between events >= {cooldown:.0f} s (1 s tolerance)", f"min gap={min(gaps):.1f} s over {len(gaps)} gaps" if gaps else "fewer than 2 events", bool(gaps) and min(gaps) >= cooldown - 1)

    n_excl = api.events(src_exclude)["total"]
    record("TC-21", "Exclude zone over the motion suppresses events", "0 events", f"{n_excl} events", n_excl == 0)

    n_inc_else = api.events(src_include_elsewhere)["total"]
    record("TC-22", "Include zone away from the motion suppresses events", "0 events", f"{n_inc_else} events", n_inc_else == 0)

    n_inc_hit = api.events(src_include_hit)["total"]
    record("TC-23", "Include zone covering the motion keeps events", ">= 1 event", f"{n_inc_hit} events", n_inc_hit >= 1)

    cfg = api.request("GET", f"/cameras/{src_disarmed}/config").json()
    n_dis = api.events(src_disarmed)["total"]
    record("TC-24", "Disarmed schedule logs nothing", "armed=false in config, 0 events, PUT 200", f"PUT={r_sched.status_code}, armed={cfg['armed']}, {n_dis} events", r_sched.status_code == 200 and cfg["armed"] is False and n_dis == 0)

    bad_zone = api.request("PUT", f"/cameras/{src_base}/zones", json=[{"name": "bad", "mode": "exclude", "points": [[0.5, 0.0], [2.0, 0.0], [1.0, 1.0]]}])
    record("TC-25", "Zone with a point outside 0..1 is rejected", "400", f"{bad_zone.status_code}", bad_zone.status_code == 400)

    two_points = api.request("PUT", f"/cameras/{src_base}/zones", json=[{"name": "line", "mode": "exclude", "points": [[0.1, 0.1], [0.9, 0.9]]}])
    record("TC-26", "Zone with fewer than 3 points is rejected", "422 (schema validation)", f"{two_points.status_code}", two_points.status_code == 422)

    same_time = api.request("PUT", f"/cameras/{src_base}/schedule", json={"enabled": True, "weekdays": [0], "start_time": "08:00:00", "end_time": "08:00:00"})
    record("TC-27", "Schedule with identical start and end is rejected", "400", f"{same_time.status_code}", same_time.status_code == 400)

    # ------------------------------------------------------ settings carry-over
    file_uri = str(Path("uploads") / f"qa_inherit_{suffix}.mp4")
    Path("uploads").mkdir(exist_ok=True)
    Path(file_uri).write_bytes(videos["static"].read_bytes())
    saved_cam = api.register("saved camera", file_uri)
    api.request("PUT", f"/cameras/{saved_cam}/zones", json=[{"name": "keep me", "mode": "exclude", "points": right_half}])
    api.request("POST", f"/cameras/{saved_cam}/start")
    api.request("POST", f"/cameras/{saved_cam}/stop")
    restarted = api.request("POST", f"/cameras/{saved_cam}/start")
    kept = api.request("GET", f"/cameras/{saved_cam}/config").json()
    record("TC-28", "Restarting a saved camera keeps its zones", "Same camera id, still has the 'keep me' zone", f"start={restarted.status_code}, zones={[z['name'] for z in kept['zones']]}", restarted.status_code == 200 and [z["name"] for z in kept["zones"]] == ["keep me"])
    api.request("POST", f"/cameras/{saved_cam}/stop")

    deleted = api.request("DELETE", f"/cameras/{saved_cam}")
    hidden = all(c["id"] != saved_cam for c in api.request("GET", "/cameras").json())
    restored = api.request("POST", "/cameras", json={"name": "saved camera again", "source_uri": file_uri}).json()
    restored_zones = [z["name"] for z in api.request("GET", f"/cameras/{restored['id']}/config").json()["zones"]]
    record("TC-39", "Delete a camera, then register its source again", "204 and hidden from the list; re-registering restores the same id and zones", f"delete={deleted.status_code}, hidden={hidden}, id={restored['id']}, zones={restored_zones}", deleted.status_code == 204 and hidden and restored["id"] == saved_cam and restored_zones == ["keep me"])

    # ----------------------------------------------------- events, clips, stats
    first_event = events[0] if events else None
    if first_event is not None:
        snap = api.request("GET", f"/events/{first_event['id']}/snapshot")
        record("TC-29", "Snapshot endpoint returns the JPEG", "200 image/jpeg", f"{snap.status_code} {snap.headers.get('content-type')} {len(snap.content)} bytes", snap.status_code == 200 and snap.headers.get("content-type") == "image/jpeg")
        clip = api.request("GET", f"/events/{first_event['id']}/clip")
        record("TC-30", "Clip endpoint returns a playable WebM", "200 video/webm, non-empty, has_clip=true", f"{clip.status_code} {clip.headers.get('content-type')} {len(clip.content)} bytes, has_clip={first_event['has_clip']}", clip.status_code == 200 and clip.headers.get("content-type") == "video/webm" and len(clip.content) > 1000 and first_event["has_clip"] is True)
    r = api.request("GET", "/events/99999999/snapshot")
    record("TC-31", "Snapshot of an unknown event", "404", f"{r.status_code}", r.status_code == 404)

    page1 = api.request("GET", "/events", params={"camera_id": src_base, "limit": 1, "offset": 0}).json()
    record("TC-32", "Timeline pagination and filtering", "limit=1 returns 1 event; total unchanged", f"returned={len(page1['events'])}, total={page1['total']}", len(page1["events"]) == 1 and page1["total"] == base["total"])

    r = api.request("GET", "/events", params={"camera_id": src_base, "from_ts": "2999-01-01T00:00:00"}).json()
    record("TC-33", "Time filter in the future returns nothing", "0 events", f"{r['total']}", r["total"] == 0)

    stats = api.request("GET", "/events/stats").json()
    total_ok = stats["total"] == sum(d["count"] for d in stats["per_day"]) == sum(c["count"] for c in stats["per_camera"]) == sum(c["count"] for c in stats["coverage"]) == sum(c["count"] for c in stats["heatmap"])
    record("TC-34", "Analytics totals are internally consistent", "total equals per-day, per-camera, heatmap and coverage sums", f"total={stats['total']}", total_ok)

    # ------------------------------------------------- per-user isolation
    twin_login = api.login(f"qa.twin.{suffix}@example.com", qa_password)
    twin_token = twin_login.json().get("access_token", "") if twin_login.status_code == 200 else ""
    twin_cameras = api.request("GET", "/cameras", token=twin_token).json()
    record("TC-40", "A new user starts with no cameras", "Empty camera list (admin's cameras are not visible)", f"{len(twin_cameras)} cameras", twin_cameras == [])

    foreign = {
        "start": api.request("POST", f"/cameras/{src_base}/start", token=twin_token).status_code,
        "stop": api.request("POST", f"/cameras/{src_base}/stop", token=twin_token).status_code,
        "rename": api.request("PATCH", f"/cameras/{src_base}", token=twin_token, json={"name": "hijacked"}).status_code,
        "frame": api.request("GET", f"/cameras/{src_base}/frame", token=twin_token).status_code,
        "config": api.request("GET", f"/cameras/{src_base}/config", token=twin_token).status_code,
        "zones": api.request("PUT", f"/cameras/{src_base}/zones", token=twin_token, json=[]).status_code,
        "schedule": api.request("PUT", f"/cameras/{src_base}/schedule", token=twin_token, json={"enabled": False, "weekdays": [0], "start_time": "08:00:00", "end_time": "09:00:00"}).status_code,
        "delete": api.request("DELETE", f"/cameras/{src_base}", token=twin_token).status_code,
    }
    still_running = next(c["status"] for c in api.request("GET", "/cameras").json() if c["id"] == src_base)
    record("TC-41", "Another user cannot touch someone else's camera", "404 on start/stop/rename/frame/config/zones/schedule/delete; camera unaffected", f"{foreign}; owner still sees status={still_running}", all(code == 404 for code in foreign.values()) and still_running != "stopped")

    twin_events = api.request("GET", "/events", token=twin_token, params={"limit": 200}).json()
    twin_by_camera = api.request("GET", "/events", token=twin_token, params={"camera_id": src_base}).json()
    twin_stats = api.request("GET", "/events/stats", token=twin_token).json()
    twin_search = api.request("GET", "/events/search", token=twin_token, params={"q": "any motion"}).json()
    leaks = twin_events["total"] + twin_by_camera["total"] + twin_stats["total"] + twin_search["total"]
    record("TC-42", "Another user sees none of the events", "0 events in the timeline, camera filter, stats and search", f"timeline={twin_events['total']}, camera filter={twin_by_camera['total']}, stats={twin_stats['total']}, search={twin_search['total']}", leaks == 0)

    if first_event is not None:
        snap_other = api.request("GET", f"/events/{first_event['id']}/snapshot", token=twin_token).status_code
        clip_other = api.request("GET", f"/events/{first_event['id']}/clip", token=twin_token).status_code
        record("TC-43", "Another user cannot fetch an event's snapshot or clip", "404 for both", f"snapshot={snap_other}, clip={clip_other}", snap_other == 404 and clip_other == 404)

    twin_own = api.request("POST", "/cameras", token=twin_token, json={"name": "twin copy", "source_uri": file_uri})
    twin_own_id = twin_own.json().get("id") if twin_own.status_code == 201 else None
    same_uri_ok = twin_own_id is not None and twin_own_id != restored["id"]
    twin_list = api.request("GET", "/cameras", token=twin_token).json()
    admin_ids = [c["id"] for c in api.request("GET", "/cameras").json()]
    record("TC-44", "Two users can register the same source URI independently", "201 with a new id; each user sees only their own camera", f"status={twin_own.status_code}, twin ids={[c['id'] for c in twin_list]}, shares id with admin={twin_own_id in admin_ids}", same_uri_ok and [c["id"] for c in twin_list] == [twin_own_id] and twin_own_id not in admin_ids)
    if twin_own_id is not None:
        api.request("DELETE", f"/cameras/{twin_own_id}", token=twin_token)

    search = api.request("GET", "/events/search", params={"q": "any motion last night?"})
    body = search.json() if search.status_code == 200 else {}
    has_key = bool(env.get("ANTHROPIC_API_KEY"))
    filters = body.get("parsed_filters", {})
    if has_key:
        record("TC-35", "Natural-language search resolves a time range", "Parsed from_ts/to_ts present", f"{search.status_code} filters={filters}", search.status_code == 200 and filters.get("from_ts") is not None)
    else:
        record("TC-35", "Natural-language search falls back when no API key is configured", "200, empty filters, all events returned", f"{search.status_code} filters={filters} total={body.get('total')}", search.status_code == 200 and not any(filters.values()) and body.get("total", 0) >= 1)

    sys_status = api.request("GET", "/system/status")
    record("TC-36", "System status reports a healthy database", "200 and database ok", f"{sys_status.status_code} {sys_status.json()}", sys_status.status_code == 200 and "ok" in json.dumps(sys_status.json()).lower())

    # event deletion removes the files
    if first_event is not None:
        files = Path(first_event["image_path"])
        existed = files.is_file()
        r = api.request("DELETE", f"/events/{first_event['id']}")
        gone = not files.is_file()
        record("TC-37", "Admin deletes an event and its files", "204; snapshot file removed", f"{r.status_code}, existed={existed}, removed={gone}", r.status_code == 204 and existed and gone)

    # ---------------------------------------------------------------- cleanup
    # Deleting is a soft delete: the cameras' events stay, but the registry isn't cluttered.
    for camera_id in (src_static, src_flicker, src_base, src_exclude, src_include_elsewhere, src_include_hit, src_disarmed, bad_cam, saved_cam):
        api.request("DELETE", f"/cameras/{camera_id}")
    for account_id in (qa_id, twin_id):
        if account_id is not None:
            api.request("PATCH", f"/auth/users/{account_id}/status", json={"is_active": False})
    Path(file_uri).unlink(missing_ok=True)

    Path(args.out).write_text(json.dumps([asdict(r) for r in results], indent=2))
    passed = sum(r.passed for r in results)
    logger.info("%d/%d passed", passed, len(results))


if __name__ == "__main__":
    main()
