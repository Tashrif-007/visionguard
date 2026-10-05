const { h1, h2, h3, p, ul, ol, code, note, tbl, fig, figrow } = require('./h');
const DG = 'assets/diagrams/';

module.exports = [
  h1('Architecture and Component-Level Design'),
  p('This chapter turns the requirements and models of the previous chapters into a component-level design: the design classes of the problem domain, the persistent data sources, the behaviour of the important components, the deployment structure, and the refactoring decisions taken along the way.'),

  // ---------------------------------------------------------------- 6.1
  h2('Architectural Overview'),
  p('VisionGuard is a client-server system. A React single-page application talks to a FastAPI backend over REST with a JWT bearer token. The backend is split into strict layers, and the long-running video work happens in background capture threads owned by a `CapturePool` rather than in request handlers.'),
  fig('fig:arch', DG + 'architecture.png', 'High-level architecture of VisionGuard', 50),
  tbl('tbl:layers', 'Backend layers and their rules', ['Layer', 'Location', 'Responsibility', 'Must not'], [14, 22, 36, 28], [
    ['Router', '`api/routers/`', 'Declare routes, read path and query parameters, apply router-level auth dependencies', 'Contain business logic'],
    ['Controller', '`controllers/`', 'Validate input, call services, map typed exceptions to HTTP status codes, return Pydantic schemas', 'Touch the database or run CV code'],
    ['Service', '`services/`', 'All business logic: dehazing, motion, zones, schedules, clips, events, auth, NL parsing', 'Know about HTTP or check authentication'],
    ['Repository', '`db/repositories/`', 'All SQL and ORM access', 'Be called from controllers or routers'],
    ['Model / schema', '`db/models.py`, `schemas/`', 'ORM tables; request and response shapes', 'Leak ORM objects into API responses'],
    ['Network model', '`models/tiny_cnn.py`', 'PyTorch `nn.Module` and weight loader', 'Contain training code'],
  ]),
  p('Authentication is enforced only at the router level through a `get_current_user` dependency (and `require_admin` for admin-only routes). Services and controllers never check credentials, which keeps them reusable and testable.'),

  // ---------------------------------------------------------------- 6.2
  h2('Design Classes'),
  p('The design classes below correspond to the problem domain (users, cameras, events, detection settings) and to the control objects that run the surveillance loop. They are grouped into entity classes (persistent), runtime control classes, and service and repository classes.'),
  fig('fig:cls_domain', DG + 'classes_domain.png', 'Entity (domain) classes and their relationships', 40),
  fig('fig:cls_runtime', DG + 'classes_services.png', 'Runtime control classes of the capture subsystem', 58),
  fig('fig:cls_layers', DG + 'classes_layers.png', 'Service classes and the repositories they depend on', 50),
  tbl('tbl:classes', 'Design classes, responsibilities and collaborators', ['Class', 'Kind', 'Responsibility', 'Main collaborators'], [17, 11, 44, 28], [
    ['User', 'Entity', 'An account that signs in; carries `role` (admin or operator) and `is_active`. Passwords are stored only as bcrypt hashes.', 'VideoSource'],
    ['VideoSource', 'Entity', 'One camera, stream or uploaded file; `is_active` marks a running feed; records which user created it.', 'User, Event, CameraZone, CameraSchedule'],
    ['Event', 'Entity', 'One logged motion event: time, snapshot path, clip path, ROI box and ROI area ratio.', 'VideoSource'],
    ['CameraZone', 'Entity', 'A named include or exclude polygon in normalized coordinates.', 'VideoSource'],
    ['CameraSchedule', 'Entity', 'Weekdays and a daily time window during which a camera is armed.', 'VideoSource'],
    ['CapturePool', 'Control', 'Owns one `CaptureManager` per active source; starts, stops, updates config and returns the latest preview JPEG. Injected through `Depends`, not a module global.', 'CaptureManager, CameraService'],
    ['CaptureManager', 'Control', 'Runs one capture thread: reads frames, applies schedule and zones, runs motion detection, ROI extraction and dehazing, applies the persistence and cooldown rules, feeds the clip recorder and queues event logging.', 'MotionDetector, ClipRecorder, CameraConfig, TinyTransmissionCNN, EventService'],
    ['LatestFrameReader', 'Control', 'Background reader for live sources that keeps only the newest frame, bounding latency to about one frame.', 'CaptureManager'],
    ['MotionDetector', 'Control', 'MOG2 background subtraction on a downscaled grayscale copy, returning a full-size binary mask.', 'CaptureManager'],
    ['ROIBox', 'Value', 'Immutable bounding box (x, y, width, height) produced by `extract_roi`.', 'CaptureManager, EventService'],
    ['ClipRecorder', 'Control', 'Keeps a rolling pre-roll buffer, assembles pre and post-roll frames into clips and writes them as WebM.', 'CaptureManager'],
    ['CameraConfig, Zone, Schedule', 'Value', 'Immutable runtime copy of a camera\'s zones and schedule; replaced as a whole when the operator saves.', 'CaptureManager, ZoneService'],
    ['TinyTransmissionCNN', 'Model', 'Four-layer CNN that refines the coarse transmission map; loaded once at startup, optional.', 'pipeline.dehaze_roi'],
    ['AuthService', 'Service', 'Password hashing and verification, JWT issue and decode, account rules (self-lockout, last admin), admin seeding.', 'UserRepository'],
    ['CameraService', 'Service', 'Start, stop and upload sources; inherits zones and schedule when a source URI is re-added.', 'VideoSourceRepository, ZoneService, CapturePool'],
    ['ZoneService', 'Service', 'Validate and store zones and schedules; build the runtime `CameraConfig`.', 'ZoneRepository'],
    ['EventService', 'Service', 'Log events (snapshot and clip path), list, delete, serve snapshot and clip, aggregate statistics.', 'EventRepository'],
    ['NlpSearch', 'Service', 'Turn a plain-English query into `ParsedFilters` through Claude structured output; never raises.', 'Claude API'],
    ['Repositories', 'Data access', 'User, VideoSource, Event and Zone repositories hold all SQL; services call them, controllers do not.', 'SQLAlchemy session'],
  ]),

  // ---------------------------------------------------------------- 6.3
  h2('Persistent Data Sources'),
  p('VisionGuard keeps structured data in PostgreSQL and binary evidence on the file system. The database stores only paths to the files, so the files can be moved to larger storage without a schema change.'),
  tbl('tbl:storage', 'Persistent data sources and the classes that use them', ['Data source', 'Technology', 'Holds', 'Classes / modules', 'Lifecycle'], [15, 14, 24, 25, 22], [
    ['users', 'PostgreSQL table', 'Accounts, roles, active flag', 'User, UserRepository, AuthService', 'Created by admin; deactivated, never deleted'],
    ['video_sources', 'PostgreSQL table', 'Cameras and uploads', 'VideoSource, VideoSourceRepository, CameraService', 'Row per start; `is_active` cleared on stop, EOF or crash'],
    ['events', 'PostgreSQL table', 'Event metadata and file paths', 'Event, EventRepository, EventService', 'Created by the capture thread; deleted by admin'],
    ['camera_zones, camera_schedules', 'PostgreSQL tables', 'Detection zones and schedules', 'CameraZone, CameraSchedule, ZoneRepository, ZoneService', 'Replaced on save; copied to a re-added source with the same URI'],
    ['snapshots/', 'JPEG files', 'Full-frame snapshot per event (dehazed ROI merged in)', 'EventService', 'Removed with the event'],
    ['clips/', 'WebM files', 'Pre and post-roll clip per event', 'ClipRecorder, EventService', 'Written under a `.part` name then renamed; removed with the event'],
    ['uploads/', 'Video files', 'Uploaded footage', 'CameraService', 'Kept after processing (no cleanup yet)'],
    ['backend/weights/tiny_cnn.pth', 'PyTorch state dict', 'Trained CNN weights', 'load_tiny_cnn', 'Read once at startup; absent file means pure DCP'],
    ['`.env`', 'Environment file', 'All settings and secrets', 'config.py (pydantic-settings)', 'Not committed to version control'],
    ['Browser localStorage', 'Web storage', 'JWT access token, theme', 'api/client.ts, useTheme', 'Cleared on sign-out or a 401 response'],
  ]),
  h3('Data access rules'),
  ul(
    'All database reads and writes go through repository functions; there are no raw queries elsewhere.',
    'Event timestamps are stored as naive UTC. Analytics converts them to the configured `SCHEDULE_TIMEZONE` inside SQL (`timezone(tz, timezone(\'UTC\', timestamp))`) before grouping by day, weekday and hour.',
    'File paths are written by the server with random UUID names and are resolved and checked with `is_relative_to` against `SNAPSHOT_DIR` or `CLIP_DIR` before being served, so a tampered row cannot read arbitrary files.',
    'The clip path is reserved when the event row is created, and the file appears a few seconds later. The clip endpoint therefore returns 404 until the file exists, and the UI retries.',
  ),

  // ---------------------------------------------------------------- 6.4
  h2('Behavioural Representations'),
  h3('State models'),
  p('{{fig:st_capture}} shows the life cycle of a capture thread. A source that cannot be opened never leaves `Opening`; a file source ends at end-of-file and deactivates itself; an operator stop moves any running state to `Stopped`.'),
  fig('fig:st_capture', DG + 'state_capture.png', 'State diagram of a CaptureManager', 62),
  p('{{fig:st_event}} follows one event from the moment the persistence and cooldown rules are satisfied. The snapshot and database row are produced on the event executor thread so the capture thread never waits for disk or the database, and the clip is completed independently when the post-roll has been collected.'),
  fig('fig:st_event', DG + 'state_event.png', 'State diagram of an event and its clip', 48),
  p('{{fig:st_armed}} shows how the armed state is derived from the schedule. The schedule is re-evaluated at most once per second.'),
  fig('fig:st_armed', DG + 'state_armed.png', 'State diagram of the armed state of a camera', 30),
  h3('Sequence models'),
  p('{{fig:sq_login}} shows authentication. The code runs a bcrypt verification against a dummy hash when the email is unknown so that response time does not reveal whether an account exists.'),
  fig('fig:sq_login', DG + 'seq_login.png', 'Sequence diagram: signing in', 50),
  p('{{fig:sq_frame}} shows what happens to every frame. This is the performance-critical path and the heart of the system.'),
  fig('fig:sq_frame', DG + 'seq_frame.png', 'Sequence diagram: processing one frame', 56),
  p('{{fig:sq_zones}} shows how a zone change reaches a running camera without restarting it.'),
  fig('fig:sq_zones', DG + 'seq_zones.png', 'Sequence diagram: saving zones', 62),
  p('{{fig:sq_search}} shows natural-language search and its fallback path.'),
  fig('fig:sq_search', DG + 'seq_search.png', 'Sequence diagram: natural-language search', 62),

  // ---------------------------------------------------------------- 6.5
  h2('Component Design Detail'),
  h3('The per-frame pipeline'),
  tbl('tbl:pipeline', 'Dehazing pipeline stages', ['Step', 'Module', 'Function', 'Output'], [6, 24, 40, 30], [
    ['1', '`motion/motion_detector.py`', 'Downscale to `MOTION_MAX_SIDE`, grayscale, blur, MOG2, threshold, dilate, resize back', 'Binary motion mask (full frame size)'],
    ['2', '`motion/zones.py`', 'AND with the camera zone mask when zones exist', 'Zone-restricted mask'],
    ['3', '`motion/roi.py`', 'Contours above `MOTION_MIN_AREA`, merged, padded, clamped; falls back to the largest contour if the merged box exceeds `ROI_MAX_AREA_RATIO`', '`ROIBox` or none'],
    ['4', '`pipeline.py`', 'Downscale the ROI to `DEHAZE_MAX_SIDE` for the classical stages', 'Small ROI'],
    ['5', '`dehazing/dark_channel.py`', 'Per-pixel channel minimum followed by erosion over a patch', 'Dark channel'],
    ['6', '`dehazing/atmosphere.py`', 'Average of the Top-K brightest dark-channel pixels, with a minimum pixel floor (no single-pixel flicker)', 'Atmospheric light A'],
    ['7', '`dehazing/transmission.py`', 't = 1 - omega * dark(I / A)', 'Coarse transmission'],
    ['8', '`dehazing/refine.py`', 'Tiny CNN refinement (skipped if no weights are loaded)', 'Refined transmission'],
    ['9', '`dehazing/guided_filter.py`', 'Edge-aware guided upsample back to full ROI size using the grayscale ROI as guide', 'Full-size transmission'],
    ['10', '`dehazing/radiance.py`', 'J = (I - A) / max(t, t_min) + A', 'Recovered radiance'],
    ['11', '`dehazing/gamma.py`', 'Gamma correction', 'Enhanced ROI merged into the frame'],
  ]),
  h3('Detection zones'),
  code(`build_zone_mask(frame_shape, zones):
    if no zones: return None                      # nothing to restrict
    includes = zones with mode == "include"
    mask = zeros if includes exist else full-frame 255
    for z in includes: fillPoly(mask, z, 255)     # union of include zones
    for z in excludes: fillPoly(mask, z, 0)       # exclude wins over include
    return mask

# in the capture loop, once per frame
if armed and past warm-up:
    motion_mask = motion_mask AND zone_mask       # mask cached per (config, frame size)
    roi = extract_roi(motion_mask)`),
  p('Zone points are stored as fractions of the frame, so the same zone works whatever resolution a camera delivers. The mask is rebuilt only when the configuration object is replaced or the frame size changes.'),
  h3('Arming schedule'),
  code(`is_armed(now, schedule):
    if schedule is None or not schedule.enabled: return True
    if start <= end:                               # same-day window
        return weekday(now) in weekdays and start <= time(now) < end
    if time(now) >= start:                         # overnight window, evening part
        return weekday(now) in weekdays
    return (weekday(now) - 1) % 7 in weekdays and time(now) < end   # morning part`),
  p('An overnight window belongs to the weekday on which it starts, so "Monday 22:00 to 06:00" covers Tuesday 01:00. While a camera is disarmed the motion model keeps learning the background, so re-arming does not trigger a burst of false motion.'),
  h3('Event persistence, cooldown and clip recording'),
  code(`on each frame with an ROI:
    motion_streak += 1
    if motion_streak >= MOTION_MIN_FRAMES and now - last_event >= EVENT_COOLDOWN_SECONDS:
        clip_path = recorder.start_clip()          # copies the pre-roll buffer
        executor.submit(log_event, frame.copy(), roi, clip_path)
on each frame without an ROI:
    motion_streak = 0
every frame (sampled at CLIP_FPS, downscaled to CLIP_MAX_WIDTH):
    buffer.append(sample); append sample to every active clip
    when a clip has CLIP_POST_SECONDS of frames: submit write_clip(clip)`),
  p('Clips are encoded as VP8 in WebM because the OpenCV build used here cannot encode H.264 and MPEG-4 Part 2 does not play in Chrome. The file is written as `name.part.webm` and renamed when complete, so the clip endpoint never serves a half-written file. Clips still recording when a file source ends are flushed so they are not lost.'),

  // ---------------------------------------------------------------- 6.6
  h2('Deployment'),
  p('{{fig:deploy}} shows the deployment structure. The system needs no GPU. All components can run on one machine, which is the configuration used for development and the demonstration, or be split across an application server and a database server.'),
  fig('fig:deploy', DG + 'deployment.png', 'Deployment diagram', 60),
  tbl('tbl:nodes', 'Deployment nodes and configuration', ['Node', 'Software', 'Port / protocol', 'Notes'], [20, 32, 20, 28], [
    ['Operator browser', 'Any current browser; React SPA served by Vite (dev) or any static host (production build)', '5173 (dev), HTTPS in production', 'Needs network access to the API; stores the JWT in localStorage'],
    ['Application server', 'Python 3.11+, uvicorn, FastAPI, OpenCV, NumPy, PyTorch (CPU wheel)', '8000, HTTP', 'Runs capture threads in-process; CPU threads capped by `TORCH_NUM_THREADS` and `CV_NUM_THREADS`; local disk for snapshots, clips and uploads'],
    ['Database server', 'PostgreSQL 14+', '5432, TCP', 'Credentials through `POSTGRES_*` variables; schema created and migrated at startup'],
    ['Camera sources', 'Webcam device index, RTSP or HTTP stream, or uploaded file', 'Device / RTSP / HTTP', 'Opened through `cv2.VideoCapture`'],
    ['Claude API', 'Anthropic SDK over HTTPS', '443', 'Optional; only used to parse search queries. Without a key search returns unfiltered results'],
  ]),
  p('The reference machine for the measurements in this report has a 12th Gen Intel Core i5-1240P (16 logical CPUs) and 7 GB of memory, with no GPU.'),

  // ---------------------------------------------------------------- 6.7
  h2('Refactoring and Alternatives Considered'),
  p('Component designs were revised several times during development. The table records the main alternatives and why the final design was chosen.'),
  tbl('tbl:decisions', 'Design decisions, alternatives and rationale', ['Concern', 'Alternative(s) considered', 'Chosen design', 'Why'], [14, 26, 28, 32], [
    ['Number of cameras', 'One global capture manager on `app.state`', '`CapturePool` keyed by source id, one `CaptureManager` per camera', 'Starting a camera must not stop another; each source needs its own detector, buffer and thread. Also removed global mutable state.'],
    ['Live capture lag', 'Read every frame in the processing loop', '`LatestFrameReader` thread that keeps only the newest frame', 'When processing is slower than the camera, an unbounded backlog makes the feed minutes late. Dropping frames bounds latency to about one frame.'],
    ['ROI size', 'Merge all motion contours into one box', 'Merge, but fall back to the largest contour above `ROI_MAX_AREA_RATIO`', 'Scattered motion made the "ROI" approach the full frame and the cost with it.'],
    ['Classical stage cost', 'Run DCP at full ROI resolution', 'Downscale to `DEHAZE_MAX_SIDE`, then guided-upsample the transmission', 'Cost becomes roughly flat in ROI size. The guided filter replaces bilinear upsampling, which smeared transmission across edges and caused halos.'],
    ['Guided filter source', '`cv2.ximgproc.guidedFilter`', 'Hand-written box-filter version (He et al.)', 'The installed `opencv-python` has no contrib module.'],
    ['CNN training loss', 'L1 on the transmission map', 'Reconstruction loss through a differentiable radiance recovery using the estimated A', 'Transmission-only loss made the final image worse because the estimated A is biased on scenes without bright sky.'],
    ['Event rate', 'Log on every motion frame; or only the cooldown', 'Minimum motion duration plus cooldown', 'A 6-frame flicker no longer creates events; sustained motion still does.'],
    ['What an event means', 'Label events "intruder" using ROI size or position heuristics', 'Label them "motion" and store the ROI area ratio', 'Frame differencing cannot tell a person from a tree or a shadow; a wrong "intruder" label would erode operator trust. Classification stays future work.'],
    ['Zones and schedules storage', 'JSON columns on `video_sources`', 'Separate `camera_zones` and `camera_schedules` tables', 'Validated rows, a unique constraint for one schedule per camera, and simple replace-all semantics.'],
    ['Settings after re-adding a camera', 'Lose them (a new source id)', 'Copy from the latest earlier source with the same URI', 'Operators should not redraw zones after every restart.'],
    ['Clip codec', 'H.264 (avc1 or H264), MPEG-4 (mp4v)', 'VP8 in WebM', 'H.264 failed to open in this OpenCV build; mp4v encodes but does not play in Chrome; VP8 plays and encodes quickly.'],
    ['Clip buffer', 'Encoded JPEG buffers, or full-resolution frames', 'Raw frames sampled at `CLIP_FPS` and downscaled to `CLIP_MAX_WIDTH`', 'No per-frame encoding cost on the capture thread; memory is bounded by pre-roll length, rate and width.'],
    ['Event persistence work', 'Write snapshot and row on the capture thread', 'Single-worker `ThreadPoolExecutor`', 'Disk and database latency must not delay the next `read()`.'],
    ['Evidence access', 'Public static `/snapshots` mount', 'Authenticated endpoints with a path-traversal guard', 'Snapshots and clips are surveillance data. The `<img>` and `<video>` elements load them as authenticated blobs.'],
    ['Login identifier', 'Username', 'Email plus display name', 'Matches how operators identify themselves; allows profile edit.'],
    ['Search parsing', 'Regular expressions for dates', 'LLM structured output with a no-filter fallback', 'Handles free phrasing; a failure widens the search instead of erroring.'],
    ['Charts', 'A charting library', 'CSS and SVG bars', 'Five simple charts; avoids a dependency and keeps the bundle small.'],
  ]),
];
