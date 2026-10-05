// Content of the chapters ADDED to the existing SPL3 technical report (chapters 7 to 12).
// The existing chapters (1 to 6) are never touched. Condensed on purpose: the existing
// document uses 14 pt body text, so the same amount of text takes far more pages.
const fs = require('fs');
const path = require('path');
const { h1, h2, h3, p, ul, ol, code, tbl, fig, figrow } = require('./content/h');
const DG = 'assets/diagrams/';
const SH = 'assets/shots/';
const acc = JSON.parse(fs.readFileSync(path.join(__dirname, 'acceptance_results.json'), 'utf8'));
const perf = JSON.parse(fs.readFileSync(path.join(__dirname, 'perf.json'), 'utf8'));
const accPassed = acc.filter((r) => r.passed).length;
const mid = perf.find((r) => r.w === 640);
const big = perf[perf.length - 1];

module.exports = [
  // ================================================================== 7
  h1('Component-Level Design'),
  p('This chapter extends the models of Chapters 3 and 4 with the component-level design of the final system: design classes, persistent data sources, behavioural models, deployment, and the refactoring decisions taken. Features added after the technical report (multi-camera capture, detection zones, arming schedules, event video clips, analytics and account management) are included, so this chapter supersedes the earlier scope and data tables where they differ.'),

  h2('Architecture Overview'),
  p('A React single-page application talks to a FastAPI backend over REST with a JWT bearer token. The backend has strict layers: routers (routes only), controllers (validation, error to HTTP status mapping), services (all business logic), repositories (all SQL) and PostgreSQL. Long-running video work runs in background capture threads owned by a CapturePool, never in request handlers. Authentication is enforced only by router-level dependencies.'),
  fig('fig:arch', DG + 'architecture.png', 'High-level architecture of VisionGuard', 42),

  h2('Design Classes'),
  p('The classes below correspond to the problem domain (users, cameras, events, detection settings) and to the control objects that run the surveillance loop.'),
  figrow(
    fig('fig:cls_domain', DG + 'classes_domain.png', 'Entity (domain) classes', 100),
    fig('fig:cls_layers', DG + 'classes_layers.png', 'Service classes and repositories', 100)
  ),
  fig('fig:cls_runtime', DG + 'classes_services.png', 'Runtime control classes of the capture subsystem', 78),
  tbl('tbl:classes', 'Design classes and their responsibilities', ['Class', 'Responsibility', 'Collaborators'], [2100, 5600, 2200], [
    ['User', 'Account with role (admin or operator) and is_active flag; password stored only as a bcrypt hash', 'VideoSource'],
    ['VideoSource', 'One camera, stream or uploaded file; is_active marks a running feed', 'User, Event, CameraZone, CameraSchedule'],
    ['Event', 'One logged motion event: time, snapshot path, clip path, ROI box and ROI area ratio', 'VideoSource'],
    ['CameraZone', 'Named include or exclude polygon in normalized (0..1) coordinates', 'VideoSource'],
    ['CameraSchedule', 'Weekdays and a daily time window during which a camera is armed', 'VideoSource'],
    ['CapturePool', 'Owns one CaptureManager per active source; start, stop, update config, latest preview JPEG. Injected with Depends, not a global', 'CaptureManager'],
    ['CaptureManager', 'One capture thread: reads frames, applies schedule and zones, motion detection, ROI, dehazing, persistence and cooldown rules; feeds the clip recorder and event logging', 'MotionDetector, ClipRecorder, CameraConfig, TinyTransmissionCNN'],
    ['LatestFrameReader', 'Keeps only the newest frame of a live source so latency stays near one frame', 'CaptureManager'],
    ['MotionDetector', 'MOG2 background subtraction on a downscaled grayscale copy; returns a full-size binary mask', 'CaptureManager'],
    ['ClipRecorder', 'Rolling pre-roll buffer; assembles pre and post-roll frames into a WebM clip', 'CaptureManager'],
    ['CameraConfig', 'Immutable runtime copy of a camera\'s zones and schedule; replaced as a whole on save', 'CaptureManager, ZoneService'],
    ['TinyTransmissionCNN', 'Refines the coarse transmission map; loaded once at startup; optional', 'pipeline.dehaze_roi'],
    ['AuthService', 'Hashing, JWT issue and decode, self-lockout and last-admin rules, admin seeding', 'UserRepository'],
    ['CameraService, ZoneService, EventService', 'Start, stop and upload sources; validate and store zones and schedules; log, serve, delete and aggregate events', 'Repositories, CapturePool'],
    ['NlpSearch', 'Turns a plain-English query into ParsedFilters through Claude structured output; never raises', 'Claude API'],
  ]),

  h2('Persistent Data Sources'),
  p('Structured data is kept in PostgreSQL and binary evidence on the file system; the database stores only file paths. The updated entity-relationship diagram follows. It replaces the diagram of Chapter 4 by adding camera_zones and camera_schedules, the users email and is_active columns, and the events roi_area_ratio and clip_path columns.'),
  fig('fig:erd', DG + 'erd.png', 'Updated ER diagram of VisionGuard', 55),
  tbl('tbl:storage', 'Persistent data sources and the classes that use them', ['Data source', 'Technology', 'Holds', 'Classes and lifecycle'], [1900, 1500, 2600, 3900], [
    ['users', 'PostgreSQL table', 'Accounts, roles, active flag', 'User, UserRepository, AuthService. Created by the admin; deactivated, never deleted'],
    ['video_sources', 'PostgreSQL table', 'Cameras and uploads', 'VideoSource, CameraService. One row per start; is_active cleared on stop, end of file or crash'],
    ['events', 'PostgreSQL table', 'Event metadata and file paths', 'Event, EventRepository, EventService. Created by the capture thread; deleted by the admin'],
    ['camera_zones, camera_schedules', 'PostgreSQL tables', 'Detection zones and schedules', 'ZoneRepository, ZoneService. Replaced on save; copied to a re-added source with the same URI'],
    ['snapshots/', 'JPEG files', 'Snapshot per event', 'EventService. Removed with the event'],
    ['clips/', 'WebM files', 'Video clip per event', 'ClipRecorder, EventService. Written as .part then renamed; removed with the event'],
    ['uploads/', 'Video files', 'Uploaded footage', 'CameraService. Kept after processing'],
    ['backend/weights/tiny_cnn.pth', 'PyTorch state dict', 'CNN weights', 'load_tiny_cnn. Read once at startup; absent file means pure DCP'],
    ['.env', 'Environment file', 'Settings and secrets', 'config.py (pydantic-settings). Not committed'],
    ['Browser localStorage', 'Web storage', 'JWT token, theme', 'api/client.ts. Cleared on sign-out or a 401 response'],
  ]),
  ul(
    'All database access goes through repository functions; there are no raw queries elsewhere.',
    'Event timestamps are stored as naive UTC; analytics converts them to SCHEDULE_TIMEZONE inside SQL before grouping.',
    'File paths use random UUID names and are checked with is_relative_to against the configured directory before being served.',
    'The clip path is reserved when the event row is created and the file appears a few seconds later, so the clip endpoint returns 404 until then and the interface retries.'
  ),

  h2('Behavioural Representations'),
  h3('State models'),
  p('{{fig:st_capture}} shows the life cycle of a capture thread and {{fig:st_event}} follows one event and its clip. The snapshot and database row are produced on a separate executor thread so the capture thread never waits for disk or the database.'),
  fig('fig:st_capture', DG + 'state_capture.png', 'State diagram of a CaptureManager', 88),
  fig('fig:st_event', DG + 'state_event.png', 'State diagram of an event and its clip', 62),
  h3('Sequence model'),
  p('{{fig:sq_frame}} shows what happens to every frame, the performance-critical path of the system.'),
  fig('fig:sq_frame', DG + 'seq_frame.png', 'Sequence diagram: processing one frame', 72),
  h3('Component logic'),
  p('Three small pure functions decide whether and where detection runs. Zone points are fractions of the frame, so a zone works at any camera resolution.'),
  code(`build_zone_mask(frame_shape, zones):
    if no zones: return None
    mask = zeros if any include zone else full-frame 255
    for z in include zones: fillPoly(mask, z, 255)
    for z in exclude zones: fillPoly(mask, z, 0)

is_armed(now, schedule):
    if schedule is None or not enabled: return True
    if start <= end: return weekday in days and start <= time < end
    if time >= start: return weekday in days            # overnight, evening part
    return (weekday - 1) % 7 in days and time < end     # overnight, morning part

per frame with an ROI:  streak += 1
    if streak >= MOTION_MIN_FRAMES and cooldown elapsed:
        clip_path = recorder.start_clip(); executor.submit(log_event, frame, roi, clip_path)
per frame without an ROI:  streak = 0`),

  h2('Deployment'),
  p('{{fig:deploy}} shows the deployment. No GPU is needed, and all nodes can run on one machine (the configuration used for development and the demonstration) or be split across an application server and a database server.'),
  fig('fig:deploy', DG + 'deployment.png', 'Deployment diagram', 64),
  tbl('tbl:nodes', 'Deployment nodes', ['Node', 'Software and port', 'Notes'], [2000, 4100, 3800], [
    ['Operator browser', 'Any current browser; React SPA (Vite dev server on 5173, or a static host)', 'Stores the JWT in localStorage'],
    ['Application server', 'Python 3.11+, uvicorn, FastAPI, OpenCV, PyTorch CPU; port 8000', 'Runs capture threads in-process; local disk for snapshots, clips and uploads'],
    ['Database server', 'PostgreSQL 14+; port 5432', 'Schema created and migrated at startup'],
    ['Camera sources', 'Webcam index, RTSP or HTTP stream, uploaded file', 'Opened with cv2.VideoCapture'],
    ['Claude API', 'Anthropic SDK over HTTPS', 'Optional; only parses search queries'],
  ]),

  h2('Refactoring and Alternatives Considered'),
  p('The component designs were revised several times. The table records the main alternatives and why the final design was chosen.'),
  tbl('tbl:decisions', 'Design decisions, alternatives and rationale', ['Concern', 'Alternative', 'Chosen design and why'], [1800, 2500, 5600], [
    ['Number of cameras', 'One global capture manager', 'CapturePool with one CaptureManager per source: starting a camera must not stop another, and global state is removed'],
    ['Live capture lag', 'Read every frame in the loop', 'LatestFrameReader keeps only the newest frame; an unbounded backlog would make the feed minutes late'],
    ['ROI size', 'Merge all motion into one box', 'Fall back to the largest contour above ROI_MAX_AREA_RATIO; scattered motion made the ROI approach the full frame'],
    ['Transmission upsampling', 'Bilinear upsampling', 'Downscaled classical stages plus a guided-filter upsample (hand-written, no opencv-contrib): flat cost and no halos'],
    ['CNN training loss', 'L1 on transmission only', 'Reconstruction loss through a differentiable radiance recovery; the transmission-only loss made the final image worse'],
    ['Event rate', 'Log every motion frame', 'Minimum motion duration plus cooldown; a 6-frame flicker no longer creates an event'],
    ['Meaning of an event', 'Label events "intruder" with heuristics', 'Label them "motion" and store the ROI area ratio; frame differencing cannot tell a person from a shadow'],
    ['Zones and schedules storage', 'JSON columns on video_sources', 'Separate tables with a unique schedule per camera; settings are copied to a re-added source with the same URI'],
    ['Clip codec', 'H.264, MPEG-4', 'VP8 in WebM: H.264 cannot be encoded by this OpenCV build and MPEG-4 does not play in Chrome'],
    ['Event persistence work', 'Write on the capture thread', 'Single-worker executor so disk and database latency never delay the next frame read'],
    ['Evidence access', 'Public /snapshots mount', 'Authenticated snapshot and clip endpoints with a path-traversal guard'],
    ['Search parsing', 'Regular expressions', 'LLM structured output with a no-filter fallback: free phrasing, and a failure widens the search instead of erroring'],
  ]),

  // ================================================================== 8
  h1('Interface Design'),
  h2('User Interface Analysis'),
  p('Operators need to answer two questions quickly: "is something happening now?" and "what happened earlier?". The interface is organised around those tasks: Live Monitoring (a grid of camera tiles), Events and Timeline (events with an evidence inspector), Event Analytics, Profile, and an Admin Console shown to administrators only. Every action gives immediate feedback (a toast with the server\'s message, a spinner, or an empty-state sentence), and light and dark themes share the same design tokens.'),
  fig('fig:ui_states', DG + 'ui_states.png', 'Interface state diagram (screen navigation)', 80),

  h2('Interface Objects and Operations'),
  tbl('tbl:ui_objects', 'Interface objects and their operations', ['Screen', 'Interface objects', 'Operations'], [1700, 4900, 3300], [
    ['Landing', 'Hero preview, Sign in button, how-it-works steps', 'Open the login page'],
    ['Login', 'Email and password fields, Sign in button, error message', 'Enter credentials, submit'],
    ['Dashboard', 'Camera chips, search box, Grid and Focus toggle, Add camera button, camera tiles, recent events strip', 'Filter cameras, switch layout, add a camera, open a recent event'],
    ['Camera tile', 'Live frame, LIVE badge, zone count and Disarmed badges, Configure and Remove buttons', 'Configure detection, remove the source'],
    ['Add camera dialog', 'Name and source fields, Add camera and Upload video buttons', 'Start a live source, upload a file'],
    ['Zones tab', 'Live frame with polygon overlay, Exclude and Include toggle, Finish zone, zone list, Save zones', 'Click to add points, finish, rename, delete, save'],
    ['Schedule tab', 'Use-a-schedule checkbox, weekday buttons, Armed-from and Until times, Save schedule', 'Choose days and window, save'],
    ['Events', 'Search box with filter chips, day-grouped event cards with Clip badge, evidence inspector', 'Browse, search, select an event'],
    ['Evidence inspector', 'Video clip and Snapshot toggle, player controls, detail list, Open full size', 'Play and seek, switch view, open image'],
    ['Analytics', 'Time range and camera selectors, KPI cards, bar charts, heatmap', 'Change range or camera, hover for values'],
    ['Profile', 'Identity card, Details and Security tabs, forms', 'Update name and email, change password'],
    ['Admin Console', 'Create-operator form, user table, event table', 'Create operator, activate or deactivate, delete events'],
  ]),

  h2('Events That Change the Interface State'),
  tbl('tbl:ui_events', 'User actions and the resulting interface state', ['Event', 'Where', 'Handling and resulting state'], [2200, 1700, 6000], [
    ['Submit credentials', 'Login', 'POST /auth/login; token stored and Dashboard opens, or an error is shown and Login stays'],
    ['API returns 401', 'Any screen', 'Axios interceptor clears the token and Login opens'],
    ['Add camera or upload', 'Add camera dialog', 'POST /start-camera or /upload-video; a new tile appears, or an error toast explains why the source cannot be opened'],
    ['Click Configure', 'Camera tile', 'Dialog opens on the Zones tab with the saved config'],
    ['Click on the frame', 'Zones tab', 'A point is appended to the draft polygon; Finish zone is enabled at 3 points'],
    ['Save zones or schedule', 'Configure dialog', 'PUT request; success toast and tile badges update, or an error toast'],
    ['Click Remove', 'Camera tile', 'POST /stop-camera/{id}; the tile disappears'],
    ['Camera list poll (4 s)', 'Dashboard', 'GET /cameras; tiles match the server, even after a page refresh'],
    ['Select event', 'Events', 'Clip is fetched (retried while the file is still being written); spinner, then video, or "Clip unavailable"'],
    ['Toggle Snapshot', 'Evidence inspector', 'Snapshot with the ROI box is shown'],
    ['Submit a search', 'Events', 'GET /events/search; filter chips and matching events'],
    ['Change range or camera', 'Analytics', 'New query; charts redraw'],
    ['Deactivate user', 'Admin Console', 'PATCH status; row shows Inactive, own row is protected'],
  ]),

  h2('Interface States as They Appear to the User'),
  p('Each figure is a real screenshot of the running application (1440 x 900), taken with live sources processing hazy footage. The analytics counts include test events and are not representative of a deployment.'),
  figrow(
    fig('fig:ui_landing', SH + 'ui_landing.png', 'Landing page', 100),
    fig('fig:ui_login', SH + 'ui_login.png', 'Sign-in page', 100)
  ),
  figrow(
    fig('fig:ui_login_error', SH + 'ui_login_error.png', 'Sign-in error state', 100),
    fig('fig:ui_add', SH + 'ui_add_camera.png', 'Add camera dialog', 100)
  ),
  fig('fig:ui_dash', SH + 'ui_dashboard.png', 'Live Monitoring with two active sources', 78),
  figrow(
    fig('fig:ui_zones', SH + 'ui_zones.png', 'Zones tab (red = exclude, green = include)', 100),
    fig('fig:ui_sched', SH + 'ui_schedule.png', 'Schedule tab', 100)
  ),
  figrow(
    fig('fig:ui_clip', SH + 'ui_events_clip.png', 'Events page with the video clip', 100),
    fig('fig:ui_snap', SH + 'ui_events_snapshot.png', 'Evidence inspector, snapshot view', 100)
  ),
  figrow(
    fig('fig:ui_analytics', SH + 'ui_analytics.png', 'Event Analytics', 100),
    fig('fig:ui_profile', SH + 'ui_profile.png', 'Profile page', 100)
  ),
  figrow(
    fig('fig:ui_admin', SH + 'ui_admin.png', 'Admin Console', 100)
  ),

  // ================================================================== 9
  h1('Implementation'),
  p('The backend is Python 3.11+ with FastAPI, OpenCV, NumPy, PyTorch (CPU), SQLAlchemy with PostgreSQL, PyJWT and passlib (bcrypt), and the Anthropic SDK for search. The frontend is React 19 with TypeScript (strict), Vite, Tailwind CSS v4, shadcn-style Radix components, TanStack Query and Axios. The code base is about 3,050 lines of backend Python, 4,960 lines of frontend TypeScript, 380 lines of unit tests and 350 lines of training code.'),
  h2('Implementation Notes for the Added Features'),
  ul(
    'Capture: live sources use a one-slot LatestFrameReader thread; file sources are paced by monotonic deadlines and skip frames when far behind. Preview JPEGs are throttled to 12 fps and 960 px width. CPU threads for PyTorch and OpenCV are capped.',
    'Zones and schedules: stored in camera_zones and camera_schedules, converted to an immutable CameraConfig and swapped into the running CaptureManager, so changes apply on the next frame. The zone mask is cached per configuration and frame size.',
    'Persistence and size: an event needs MOTION_MIN_FRAMES (15) consecutive motion frames and EVENT_COOLDOWN_SECONDS (5 s); each event stores roi_area_ratio.',
    'Clips: frames are sampled at 10 fps, downscaled to 640 px and written as VP8 WebM (4 s before and 6 s after the event). Clips still recording when a file ends are flushed.',
    'Analytics: GET /events/stats runs four aggregate queries (per day, per camera, weekday by hour, ROI size buckets) with times converted to SCHEDULE_TIMEZONE in SQL.',
    'Security: bcrypt hashes, PyJWT tokens, router-level auth, authenticated snapshot and clip endpoints, Pydantic validation, no open registration. A legacy unique index on the user name was dropped so two accounts may share a display name.',
    'Frontend: all server state in React Query; media loaded as authenticated blobs with revoked object URLs; the zone editor is an SVG with a 0..1 view box so clicks map directly to normalized zone points; clip loading retries while the file is written; event times (stored as UTC) are parsed as UTC.'
  ),
  h2('Performance'),
  p('Per-frame cost of the dehazing step on the reference machine (Intel Core i5-1240P, CPU only, no GPU; real hazy street frame, mean of 40 runs). The budget for 30 FPS is 33 ms per frame.'),
  tbl('tbl:perf', 'Dehazing cost per ROI size (milliseconds per frame)', ['ROI size', 'DCP only', 'DCP + Tiny CNN', 'Within 33 ms'], [2500, 2400, 2700, 2300],
    perf.map((r) => [`${r.w} x ${r.h}`, r.dcp.toFixed(1), r.cnn.toFixed(1), r.cnn <= 33 ? 'Yes' : 'No'])),
  p('Typical motion regions (a person or a vehicle) fall in the smaller rows. A very large ROI lowers that camera\'s processed frame rate but does not stop capture, because the live reader drops stale frames. Whole-system throughput with many cameras was not benchmarked.'),

  // ================================================================== 10
  h1('Testing'),
  p('This chapter extends the preliminary test plan of Chapter 5 with the testing strategy, pass and fail criteria, executed test cases with their outcomes, and risks and contingencies.'),
  h2('Testing Approach and Strategy'),
  ul(
    'Unit tests (pytest): pure image-processing and decision logic: dark channel, transmission, atmospheric light, CNN inference and loading, motion detector, ROI extraction, pipeline round trip, zone masks, schedule evaluation.',
    'API acceptance tests (tests/acceptance_api.py): a script that drives the public HTTP API of a live server with a real PostgreSQL database and synthetic videos, so every outcome is deterministic: a moving rectangle must create events, a static scene or a 6-frame blink must create none, and copies of the moving clip run with different zone or schedule settings.',
    'System walkthrough: manual use of the interface in a real browser while two sources processed hazy footage (Chapter 8 screenshots).'
  ),
  h2('Item Pass and Fail Criteria'),
  ul(
    'A test case passes when the actual result equals the expected result in every stated part (status code, content type, count, state); otherwise it fails.',
    'The unit suite must pass completely before an acceptance run starts, and the acceptance run passes only when every case passes. A failing case must be fixed, or recorded as a known defect with a contingency, before release.',
    'Performance: for ROI sizes up to 640 x 360 the full pipeline stays within the 33 ms per-frame budget on the reference CPU.',
    'Suspension: if the server cannot start or the database is unreachable the run is suspended until the environment is repaired.'
  ),
  p('Test environment: Intel Core i5-1240P (16 logical CPUs), 7 GB RAM, Linux, no GPU; Python 3.12, uvicorn on port 8000, PostgreSQL on localhost, Vite on port 5173, Chrome 135 for the walkthrough. ANTHROPIC_API_KEY was empty, so only the search fallback was exercised.'),
  h2('Test Cases and Outcomes'),
  p('All 40 unit tests passed (about two seconds). All ' + acc.length + ' API acceptance cases passed. The unit tests are summarised by file, and every acceptance case is listed with its expected and actual outcome.'),
  tbl('tbl:unit', 'Unit tests by file (40 tests, all passed)', ['File', 'Tests', 'Behaviours verified'], [2500, 800, 6600], [
    ['test_dark_channel.py', '5', 'Black and white images, minimum bound, saturated colours, patch spreading'],
    ['test_transmission.py', '4', 'High and low transmission, clipping to [0, 1], Top-K atmospheric light'],
    ['test_cnn_inference.py', '7', 'Output shape and range, geometry, large-ROI downscale, pure-DCP fallback, missing weights return None, weights round trip'],
    ['test_motion_detector.py', '3', 'Static scene, moving object, binary mask'],
    ['test_roi.py', '7', 'Empty mask, padding and clamping, minimum area, merging, largest-blob fallback'],
    ['test_pipeline.py', '3', 'Shape and dtype, scattering-model round trip, contrast increase'],
    ['test_zones.py', '5', 'No zones, include only, exclude only, exclude inside include, motion masking'],
    ['test_schedule.py', '6', 'Always armed, same-day window, weekday filter, overnight window and its morning part'],
  ]),
  tbl('tbl:acceptance', 'API acceptance test cases with expected and actual outcomes', ['ID and case', 'Expected outcome', 'Actual outcome', 'Result'], [2600, 2300, 4200, 800],
    acc.map((r) => [`${r.case_id} ${r.title}`, r.expected, r.actual.replace(/\|/g, '/'), r.passed ? 'Pass' : 'FAIL'])),
  p('Interface walkthrough: wrong credentials stay on the sign-in page with an error; two sources ran side by side, each with its own ROI box and Configure button; polygons were drawn and saved with the tile badge updating without a reload; a weeknight schedule showed the Disarmed badge outside its window; an event with a clip played with the ROI box, a brand-new event first showed "still being recorded"; the analytics page rendered with no console errors.'),
  p('Performance results are in {{tbl:perf}}: ' + mid.cnn.toFixed(1) + ' ms at 640 x 360 and ' + big.cnn.toFixed(1) + ' ms at ' + big.w + ' x ' + big.h + ' with the CNN. Seven synthetic sources ran at the same time during the acceptance run.'),
  h3('Not tested'),
  ul(
    'Natural-language time parsing with the real Claude API (no key was configured); only the fallback is verified.',
    'Physical webcams and RTSP cameras in the final run, many-camera load and long-duration tests, and browsers other than Chrome.',
    'mypy and black were not run because they are not installed in the final environment, and the frontend has no automated tests.'
  ),
  h2('Risks and Contingencies'),
  tbl('tbl:risks', 'Risks and contingencies', ['Risk', 'Contingency'], [3700, 6200], [
    ['Claude API unavailable or key missing', 'Search falls back to unfiltered results; the timeline stays fully usable'],
    ['CNN weights missing or corrupt', 'load_tiny_cnn returns None and the pipeline runs pure DCP; a warning is logged'],
    ['Processing slower than the camera frame rate', 'The live reader drops stale frames; ROI cap, downscaled stages and thread caps limit cost; thresholds are configurable'],
    ['Many false events (foliage, shadows, lighting)', 'Exclude zones, schedules, MOTION_MIN_FRAMES, cooldown and the ROI area ratio'],
    ['Disk fills with snapshots, clips and uploads', 'Directories are configurable; deleting an event removes its files; automatic retention is future work'],
    ['Clip memory too high on small hardware', 'Lower CLIP_MAX_WIDTH, CLIP_FPS or CLIP_PRE_SECONDS'],
    ['Camera becomes unreachable', 'The source is deactivated and leaves the dashboard; re-adding it restores its zones and schedule'],
    ['Server crash with active sources', 'Stale active sources are deactivated at startup, so no ghost cameras appear'],
    ['Database unavailable', '/system/status reports the state; the API recovers when the database returns'],
  ]),

  // ================================================================== 11
  h1('User Manual'),
  h2('Installation'),
  p('Requirements: Python 3.11+, Node.js 18+, PostgreSQL 14+, a current browser, and optionally an Anthropic API key for natural-language search. No GPU is needed.'),
  ol(
    'Get the code: git clone https://github.com/Tashrif-007/visionguard.git, then open the visionguard folder.',
    'Backend: python3 -m venv venv, source venv/bin/activate, pip install -r requirements.txt, createdb visionguard, cp .env.example .env.',
    'Edit .env: set the POSTGRES_* values, a long random JWT_SECRET_KEY, and ADMIN_EMAIL and ADMIN_PASSWORD (the first administrator). ANTHROPIC_API_KEY is optional.',
    'Start the API from the repository root: uvicorn backend.main:app --port 8000. Tables are created and the administrator is seeded on first start.',
    'Frontend: cd frontend, npm install, cp .env.example .env, npm run dev, then open http://localhost:5173.',
    'Check the installation: run pytest (all tests pass) and sign in with the administrator email and password.'
  ),
  h2('Signing In, Monitoring and Adding Cameras'),
  ul(
    'Open the application, choose Sign in to monitor, and enter your email and password ({{fig:ui_login}}). Accounts are created by an administrator; there is no sign-up.',
    'Live Monitoring ({{fig:ui_dash}}) shows one tile per active camera with a green box where motion was found; inside the box the haze has been removed.',
    'To add a camera press Add camera ({{fig:ui_add}}), type an optional name, enter a webcam index (0), a stream address (rtsp://...) or a file path, and press Add camera. Press Upload video to process a video file instead; its tile disappears when the video ends.',
    'Use the search box to find a tile, Grid or Focus to change the layout, and Remove to stop one source without affecting the others. A Disarmed badge means the camera is outside its schedule.'
  ),
  h2('Detection Zones and Schedules'),
  ol(
    'Press Configure on a tile and stay on the Zones tab ({{fig:ui_zones}}).',
    'Choose Exclude (ignore this area) or Include (watch only this area), click at least three corners on the picture, and press Finish zone. Repeat for more zones; rename or delete zones in the list.',
    'Press Save zones. The running camera uses them immediately. With any include zone only those areas are watched (minus exclude zones inside them); with only exclude zones everything is watched except those areas.',
    'For a schedule open the Schedule tab ({{fig:ui_sched}}), tick Use a schedule, choose the weekdays, set Armed from and Until (an end earlier than the start runs past midnight), and press Save schedule. Outside the window the camera keeps streaming but detects and records nothing.'
  ),
  h2('Reviewing Events, Search and Analytics'),
  ul(
    'Open Events and Timeline ({{fig:ui_clip}}). Events are grouped by day, newest first; a Clip badge marks events that have video. Click an event to open the Evidence inspector: the Video clip tab plays a few seconds before and after the event with the motion box visible, and the Snapshot tab ({{fig:ui_snap}}) shows the still frame. A clip that is still being recorded loads by itself.',
    'Type a plain-English question such as "any motion last night?" in the search box and press Enter; the interpreted time range appears as chips. If no time can be understood, all events are shown.',
    'Event Analytics ({{fig:ui_analytics}}) shows totals, the busiest hour, events per day, per hour and per camera, a weekday-by-hour heatmap and the size of the motion. Choose a time range and optionally one camera. Use the heatmap to choose schedules and zones.',
    'Events are recorded as motion. VisionGuard does not decide whether the motion is a person or vehicle; watch the video to decide.'
  ),
  h2('Profile and Administration'),
  ul(
    'Profile ({{fig:ui_profile}}): change your name and email (your sign-in name) on Details, and your password on Security (at least 8 characters).',
    'Administrators have the Admin Console ({{fig:ui_admin}}): create operator accounts, deactivate or reactivate accounts (you cannot deactivate yourself or the last active administrator), and delete events together with their snapshot and clip.'
  ),
  h2('Troubleshooting'),
  tbl('tbl:trouble', 'Common problems', ['Problem', 'Likely cause and what to do'], [3300, 6600], [
    ['"Cannot open video source"', 'Wrong address, camera offline, or the path does not exist on the server; check it in a media player'],
    ['No events appear', 'Camera disarmed, motion outside include zones, or motion shorter than half a second; check the Disarmed badge, zones and schedule'],
    ['Too many events', 'Foliage, shadows or lighting; add exclude zones or raise MOTION_MIN_FRAMES or MOTION_MIN_AREA'],
    ['Clip says "unavailable"', 'The encoder could not create the file; check the server log; the snapshot is still available'],
    ['Search returns every event', 'No time understood or no API key; rephrase with a time such as "yesterday" or set ANTHROPIC_API_KEY'],
    ['Signed out unexpectedly', 'The token expired or the account was deactivated; sign in again or ask an administrator'],
  ]),

  // ================================================================== 12
  h1('Repository, Installer and Final Deliverables'),
  h2('Version Control'),
  p('The source code is in a publicly accessible Git repository: https://github.com/Tashrif-007/visionguard. It has two long-lived branches, main (stable) and dev (integration). Work is done on feature branches (for example feature/authentication, feature/nlp-search, feature/frontend-dashboard) merged into dev with explicit merge commits, and commit messages use short type prefixes such as feat and docs. .env files, virtual environments, uploads, snapshots and clips are excluded through .gitignore.'),
  h2('Installer'),
  p('Not applicable: VisionGuard is installed from source with the steps in Chapter 11. A container image that packages the backend, frontend and database is a reasonable future deliverable.'),
  h2('Coverage of the Final Report Requirements'),
  tbl('tbl:comply', 'Where each required item is covered', ['Required item', 'Covered in'], [5600, 4300], [
    ['Design classes of the problem domain', 'Chapter 7, Design Classes'],
    ['Persistent data sources and their classes', 'Chapter 4 and Chapter 7, Persistent Data Sources'],
    ['Behavioural representations of classes and components', 'Chapter 7, Behavioural Representations'],
    ['Deployment diagrams', 'Chapter 7, Deployment'],
    ['Refactoring and alternatives', 'Chapter 7, Refactoring and Alternatives Considered'],
    ['User interface objects and operations', 'Chapter 8, Interface Objects and Operations'],
    ['Events that change the interface state', 'Chapter 8, Events That Change the Interface State'],
    ['Each interface state as it looks to the user', 'Chapter 8, Interface States as They Appear to the User'],
    ['Testing approach, pass and fail criteria, risks and contingencies', 'Chapter 10'],
    ['Test cases with detailed outcomes', 'Chapter 10, Test Cases and Outcomes'],
    ['Implementation details', 'Chapter 9'],
    ['User manual, repository URL, installer', 'Chapter 11 and this chapter'],
  ]),
];
