const { h1, h2, h3, p, ul, ol, code, note, tbl, fig, figrow } = require('./h');
const SH = 'assets/shots/';
const DG = 'assets/diagrams/';
const perf = require('../perf.json');

module.exports = [
  // ------------------------------------------------------------------ 7
  h1('Interface Design'),
  h2('User Interface Analysis'),
  p('The primary users are guards and operators who watch several cameras and need to answer two questions quickly: "is something happening now?" and "what happened earlier?". The interface was designed around those two tasks.'),
  ul(
    '**Glanceable monitoring.** The live view is a grid of camera tiles. Each tile shows a LIVE indicator, the processed frame with the motion ROI box, the source type, and badges for zones and disarmed state.',
    '**One place per task.** Live Monitoring, Events and Timeline, Event Analytics, Profile and the Admin Console are separate sidebar entries; the sidebar collapses to icons on narrow screens.',
    '**Immediate feedback.** Every mutation shows a toast (success or the server\'s error message); long operations show a spinner or a "still being recorded" message instead of a blank area.',
    '**Evidence first.** Selecting an event opens the video clip with the ROI box, and the snapshot is one click away.',
    '**Light and dark themes** using the same design tokens, switchable from the top bar.',
    '**Role awareness.** The Admin Console link and route exist only for administrators.'
  ),
  h2('Navigation Structure'),
  p('{{fig:ui_states}} shows the screens and the user actions that move between them. A 401 response from the API, or signing out, always returns the user to the login page.'),
  fig('fig:ui_states', DG + 'ui_states.png', 'Interface state diagram (screen navigation)', 64),
  p('The frontend follows the same layering discipline as the backend ({{fig:fe_layers}}): pages compose components, components use React Query hooks, hooks call pure Axios functions, and no component calls the network directly.'),
  fig('fig:fe_layers', DG + 'frontend_layers.png', 'Frontend layers', 30),
  h2('Interface Objects and Operations'),
  tbl('tbl:ui_objects', 'Interface objects and their operations, by screen', ['Screen', 'Interface objects', 'Operations'], [16, 42, 42], [
    ['Landing', 'Hero with hazy and dehazed preview, "Sign in to monitor" button, how-it-works steps', 'Open the login page'],
    ['Login', 'Email field, password field, Sign in button, error message', 'Enter credentials; submit; show error on failure'],
    ['Dashboard', 'Camera chip bar, search box, Grid and Focus toggle, Add camera button, camera tiles, recent events strip, system status', 'Filter cameras by name; switch layout; add a camera; open a recent event'],
    ['Camera tile', 'Live frame, LIVE badge, zone-count and Disarmed badges, type badge, Configure button, Remove button', 'Configure detection; remove the source'],
    ['Add camera dialog', 'Name field, source field (device index, RTSP URL or file path), Add camera button, Upload video button', 'Start a live source; upload and start a file'],
    ['Configure dialog: Zones', 'Live frame with polygon overlay, Exclude/Include toggle, Finish zone, Clear drawing, zone list with rename and delete, Save zones', 'Click to add polygon points; finish; rename; delete; save'],
    ['Configure dialog: Schedule', 'Use-a-schedule checkbox, weekday toggle buttons, Armed-from and Until time inputs, Save schedule', 'Enable; choose days and window; save'],
    ['Events', 'Search box with parsed-filter chips, event count, day-grouped timeline cards (thumbnail, type badge, Clip badge, ROI, source, frame), evidence inspector', 'Browse; search; select an event'],
    ['Evidence inspector', 'Video clip and Snapshot toggle, video player with controls, snapshot with ROI overlay, detail list (type, time, source, ROI, coverage, frame), Open full size', 'Play, pause and seek the clip; switch to snapshot; open the image'],
    ['Analytics', 'Time range and camera selectors, KPI cards, bar charts, heatmap', 'Change range or camera; hover cells and bars for values'],
    ['Profile', 'Identity card, Details and Security tabs, name and email form, password form', 'Update name and email; change password'],
    ['Admin Console', 'Accounts and Events tabs, create-operator form, user table, event table', 'Create an operator; activate or deactivate; delete events'],
  ]),
  h2('Events That Change the Interface State'),
  tbl('tbl:ui_events', 'User actions, system events and the resulting interface state', ['Event', 'Where', 'Handling', 'Resulting state'], [22, 16, 36, 26], [
    ['Submit credentials', 'Login', '`POST /auth/login`; on success store token', 'Dashboard; or error message and stay on Login'],
    ['API returns 401', 'Any screen', 'Axios response interceptor clears the token', 'Login'],
    ['Click Add camera', 'Dashboard', 'Open dialog', 'Add camera dialog'],
    ['Add camera / Upload', 'Add camera dialog', '`POST /start-camera` or `/upload-video`; invalidate camera list', 'New tile appears; or error toast (for example unreachable source)'],
    ['Click Configure', 'Camera tile', 'Open dialog; load `GET /cameras/{id}/config`', 'Configure dialog on the Zones tab'],
    ['Click on the frame', 'Zones tab', 'Append a point to the draft polygon', 'Draft outline drawn; "Finish zone" enabled at 3 points'],
    ['Finish zone', 'Zones tab', 'Add polygon to the zone list', 'Zone drawn and listed; Save enabled'],
    ['Save zones / schedule', 'Configure dialog', '`PUT` call; on success update the cached config', 'Success toast; tile badges update; or error toast'],
    ['Click Remove', 'Camera tile', '`POST /stop-camera/{id}`', 'Tile disappears'],
    ['Camera list poll (4 s)', 'Dashboard', '`GET /cameras`', 'Tiles added or removed to match the server, even after a page refresh'],
    ['Select event', 'Events', 'Set selected id; fetch clip blob (retry on 404)', 'Inspector shows spinner, then the video, or "Clip unavailable"'],
    ['Toggle Snapshot', 'Evidence inspector', 'Switch view state', 'Snapshot with ROI box'],
    ['Type search and submit', 'Events', '`GET /events/search`', 'Filter chips and matching events'],
    ['Change range or camera', 'Analytics', 'New query key triggers `GET /events/stats`', 'Charts redraw'],
    ['Deactivate user', 'Admin Console', '`PATCH /auth/users/{id}/status`', 'Row shows Inactive; own row is protected'],
    ['Toggle theme', 'Top bar', 'Persist choice; switch design tokens', 'Light or dark theme'],
  ]),
  h2('Interface States as They Appear to the User'),
  p('Each screen below is a real screenshot of the running application (light theme, 1440 x 900), taken with live camera sources processing hazy footage.'),
  h3('Landing and Sign-in'),
  figrow(
    fig('fig:ui_landing', SH + 'ui_landing.png', 'Landing page', 100),
    fig('fig:ui_login', SH + 'ui_login.png', 'Sign-in page', 100)
  ),
  figrow(
    fig('fig:ui_login_error', SH + 'ui_login_error.png', 'Sign-in page after rejected credentials (error state)', 100),
    fig('fig:ui_add', SH + 'ui_add_camera.png', 'Add camera dialog', 100)
  ),
  h3('Live Monitoring'),
  p('The dashboard shows each active source as a tile. The ROI rectangle is drawn on the processed frame where motion was found, and the dehazed region is merged back into the frame.'),
  fig('fig:ui_dash', SH + 'ui_dashboard.png', 'Live Monitoring with two active sources', 82),
  h3('Zone and Schedule Configuration'),
  p('The zone editor draws on top of the live frame. Red polygons are exclude zones and green polygons are include zones. In this example the sky and buildings are excluded and the road is included.'),
  figrow(
    fig('fig:ui_zones', SH + 'ui_zones.png', 'Configure dialog, Zones tab', 100),
    fig('fig:ui_sched', SH + 'ui_schedule.png', 'Configure dialog, Schedule tab (weeknights 18:00 to 07:00)', 100)
  ),
  h3('Events and Evidence'),
  figrow(
    fig('fig:ui_clip', SH + 'ui_events_clip.png', 'Events page with the video clip of the selected event', 100),
    fig('fig:ui_snap', SH + 'ui_events_snapshot.png', 'Evidence inspector showing the snapshot with the ROI overlay', 100)
  ),
  h3('Analytics, Profile and Administration'),
  fig('fig:ui_analytics', SH + 'ui_analytics.png', 'Event Analytics', 82),
  figrow(
    fig('fig:ui_profile', SH + 'ui_profile.png', 'Profile page', 100),
    fig('fig:ui_admin', SH + 'ui_admin.png', 'Admin Console', 100)
  ),
  note('The analytics figures include events produced during development and testing, so the counts are not representative of a production deployment.'),
  h2('Feedback, Accessibility and Error Handling Conventions'),
  ul(
    'Icon-only controls carry `aria-label` and `title` text; dialogs close with the Escape key and trap focus (Radix primitives).',
    'Forms use native validation (required, email, minimum length) before a request is sent.',
    'Server errors are surfaced as toasts using the API\'s `detail` message; unexpected failures fall back to a generic message.',
    'Empty states have text: "No active cameras, use Add camera above to start one", "No events found", "Select an event to inspect it".',
    'Images and video are loaded as authenticated blobs; object URLs are revoked on replacement and unmount so long-running live views do not leak memory.'
  ),

  // ------------------------------------------------------------------ 8
  h1('Implementation'),
  h2('Technology Stack'),
  tbl('tbl:stack', 'Technology stack', ['Layer', 'Technology'], [24, 76], [
    ['Language / runtime', 'Python 3.11+ (backend and training), TypeScript (frontend)'],
    ['Web framework', 'FastAPI with uvicorn; Pydantic and pydantic-settings'],
    ['Computer vision', 'OpenCV (MOG2, contours, filters, VideoWriter), NumPy'],
    ['Deep learning', 'PyTorch, CPU wheel only'],
    ['Database', 'PostgreSQL through SQLAlchemy 2 and psycopg2'],
    ['Authentication', 'PyJWT (HS256) and passlib with bcrypt'],
    ['NLP query parsing', 'Anthropic SDK, structured output through `messages.parse`'],
    ['Frontend', 'React 19, Vite, Tailwind CSS v4, shadcn-style component primitives (Radix), TanStack Query, Axios, react-router, sonner toasts, lucide icons'],
    ['Quality tools', 'pytest for tests; ruff, black, isort and mypy are the project\'s standard linters and formatters; strict TypeScript and oxlint on the frontend'],
  ]),
  h2('Source Layout and Size'),
  code(`visionguard/
  backend/
    api/routers/      auth, camera, zones, events, search, system
    controllers/      HTTP mapping and error to status code
    services/         pipeline, dehazing/, motion/, capture_service, clip_recorder,
                      camera_service, zone_service, schedule, event_service,
                      auth_service, nlp_search, runtime_tuning
    models/           tiny_cnn.py
    schemas/          Pydantic request and response models
    db/               database.py, models.py, repositories/
    config.py  main.py  weights/
  frontend/src/       api/  hooks/  components/  pages/  types/  utils/
  training/           dataset.py  revide.py  train.py
  tests/              unit tests and acceptance_api.py`),
  tbl('tbl:size', 'Size of the code base (lines, measured with wc)', ['Part', 'Lines'], [60, 40], [
    ['Backend Python (`backend/`)', '3,050'],
    ['Frontend TypeScript and TSX (`frontend/src/`)', '4,960'],
    ['Unit tests (`tests/test_*.py`)', '380'],
    ['Training code (`training/`)', '350'],
  ]),
  h2('Backend Implementation Notes'),
  h3('Startup'),
  p('The FastAPI lifespan function caps CPU threads for PyTorch and OpenCV, creates tables, runs the idempotent column migrations, seeds the admin if no user exists, deactivates sources left active by a crashed run, loads the CNN weights once, and creates the `CapturePool`. Weights are never loaded inside a request handler.'),
  h3('Capture loop'),
  ul(
    '**Live sources** use `_LatestFrameReader`, a thread that continuously reads and keeps only the newest frame behind a lock.',
    '**File sources** play at native frame rate using monotonic-deadline pacing; if processing falls far behind, frames are skipped with `grab()` instead of playing slower and slower. A file source deactivates itself at end of file.',
    '**Preview** JPEG encoding is throttled to `PREVIEW_FPS` (12), downscaled to `PREVIEW_MAX_WIDTH` (960) and encoded at quality 70; the latest JPEG is kept behind a lock for `GET /frame/{id}`.',
    '**Event logging** runs on a single-worker executor with a copy of the frame taken before the ROI rectangle is drawn.',
    '**Thread caps.** `TORCH_NUM_THREADS` and `CV_NUM_THREADS` stop PyTorch and OpenCV from oversubscribing the machine (the defaults were 12 and 16 threads on a 16-CPU machine).'
  ),
  h3('Motion detection and ROI'),
  p('Detection runs MOG2 on a grayscale copy at most `MOTION_MAX_SIDE` (480) pixels wide and resizes the mask back to full resolution, so everything downstream works in full-frame coordinates. `extract_roi` keeps contours above `MOTION_MIN_AREA`, merges them into one padded box clamped to the frame, and returns the single largest contour instead if the merged box would exceed `ROI_MAX_AREA_RATIO` of the frame. The first `MOTION_WARMUP_FRAMES` frames are ignored because MOG2 reports false motion while it learns the background.'),
  h3('Dehazing'),
  p('The pipeline is described step by step in {{tbl:pipeline}}. Two details matter for quality and speed. The atmospheric light is the average of the Top-K brightest dark-channel pixels with a minimum pixel count, which avoids the frame-to-frame flicker of a single brightest pixel even after downscaling. The refined transmission is upsampled with an edge-aware guided filter that uses the full-resolution grayscale ROI as guide, which removes the halos that bilinear upsampling produced around depth edges.'),
  h3('Natural-language search'),
  p('`nlp_search.parse_query` sends the query and the current time to Claude with a small Pydantic model as the structured output schema and returns `ParsedFilters` (from, to, event type). Every failure path (no API key, network error, invalid output) logs a warning and returns empty filters, so the controller runs the normal SQL query without filters and the user sees all events. The model, token limit and timeout are settings.'),
  h3('Analytics queries'),
  p('`GET /events/stats` runs four aggregate queries filtered by time range and camera: events per local day, events per camera (joined to `video_sources`), a weekday-by-hour count, and a bucketed count of the ROI area ratio. Day, weekday and hour are computed in the database after converting the stored UTC timestamp to `SCHEDULE_TIMEZONE`.'),
  h3('Authentication and authorisation'),
  p('Login verifies a bcrypt hash and issues an HS256 JWT valid for `JWT_EXPIRE_MINUTES`. If the email is unknown the code still verifies against a dummy hash, so response time does not reveal which emails exist. Inactive accounts cannot sign in. The service layer refuses to deactivate your own account or the last active admin. The admin is seeded from `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` only when no users exist.'),
  h2('Frontend Implementation Notes'),
  ul(
    '**Server state only in React Query.** Hooks wrap pure API functions: for example `useActiveCameras` polls every 4 s so the grid always reflects the server and survives a page refresh; `useLiveFrame` polls every 120 ms; `useEventSnapshot` and `useEventClipObjectUrl` cache blobs forever because a stored event never changes.',
    '**Authenticated media.** Because `<img>` and `<video>` cannot send an Authorization header, frames, snapshots and clips are fetched as blobs and shown through object URLs that are revoked on replacement and unmount.',
    '**Clip retry.** A 404 for a fresh event means the clip is still being written, so the clip query retries every 1.5 s up to 12 times before showing "Clip unavailable".',
    '**Zone editor.** The overlay is an SVG with a 0..1 view box stretched over the image, so a click is converted to normalized coordinates by dividing the offset in the SVG by its size. The same normalized points are sent to the server and used to rasterise the mask there.',
    '**Strict typing.** All API shapes are declared once in `types/index.ts` and mirror the Pydantic schemas; there are no `any` types.',
    '**Axios interceptors.** The request interceptor attaches the bearer token; the response interceptor clears the token and redirects to the login page on 401.',
    '**Timestamps.** The API sends event times as naive UTC; the frontend parses a timestamp without an offset as UTC so "x minutes ago" and clock times are correct in the browser\'s timezone.'
  ),
  h2('Configuration'),
  p('Every threshold, path and secret is read from `.env` through `backend/config.py`. The most important settings and their defaults are listed in {{tbl:config}}.'),
  tbl('tbl:config', 'Main configuration settings', ['Setting', 'Default', 'Purpose'], [30, 14, 56], [
    ['`MOTION_MIN_AREA`', '500', 'Smallest contour (pixels) treated as motion'],
    ['`MOTION_WARMUP_FRAMES`', '30', 'Frames ignored while MOG2 learns the background'],
    ['`MOTION_MIN_FRAMES`', '15', 'Consecutive motion frames required before an event is logged'],
    ['`EVENT_COOLDOWN_SECONDS`', '5.0', 'Minimum time between events on one camera'],
    ['`ROI_PADDING`, `ROI_MAX_AREA_RATIO`', '20, 0.35', 'ROI padding and the area cap for merged boxes'],
    ['`DCP_PATCH_SIZE`, `DEHAZE_OMEGA`, `DEHAZE_T_MIN`, `DEHAZE_GAMMA`', '15, 0.95, 0.1, 0.85', 'Dark channel patch, haze retention, transmission floor, gamma'],
    ['`ATMO_TOP_K_RATIO`, `ATMO_MIN_PIXELS`', '0.001, 32', 'Top-K fraction and minimum pixels for atmospheric light'],
    ['`DEHAZE_MAX_SIDE`, `REFINE_MAX_SIDE`', '256, 256', 'Resolution caps for the classical stages and the CNN'],
    ['`GUIDED_FILTER_RADIUS`, `GUIDED_FILTER_EPS`', '24, 1e-3', 'Guided upsample parameters'],
    ['`PREVIEW_FPS`, `PREVIEW_MAX_WIDTH`, `PREVIEW_JPEG_QUALITY`', '12, 960, 70', 'Live preview rate, width and quality'],
    ['`CLIP_PRE_SECONDS`, `CLIP_POST_SECONDS`, `CLIP_FPS`, `CLIP_MAX_WIDTH`', '4, 6, 10, 640', 'Clip length before and after the event, sampling rate and width'],
    ['`SCHEDULE_TIMEZONE`, `MAX_ZONES_PER_CAMERA`', 'UTC, 10', 'Timezone for schedules and analytics; zone limit'],
    ['`TORCH_NUM_THREADS`, `CV_NUM_THREADS`', '2, 4', 'CPU thread caps'],
    ['`JWT_SECRET_KEY`, `JWT_EXPIRE_MINUTES`', '(set), 720', 'Token signing key and lifetime'],
    ['`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`', '(empty), claude-opus-5', 'Optional natural-language search'],
  ]),
  h2('Security Measures'),
  ul(
    'Passwords are hashed with bcrypt; plaintext passwords are never stored or logged.',
    'Tokens are issued and verified with PyJWT; no hand-written crypto.',
    'Every route except login requires a valid token; admin-only routes use `require_admin`.',
    'There is no open registration; accounts are created by an admin.',
    'Snapshots and clips are not publicly mounted; they are served by authenticated endpoints that resolve the stored path and verify it lies under the configured directory.',
    'Inputs are validated by Pydantic schemas (zone point range and count, schedule weekdays, password length); invalid input returns 4xx instead of reaching the database.',
    '`.env` is excluded from version control.'
  ),
  h2('Performance Results'),
  p(`Per-frame cost of \`dehaze_roi\` was measured on the reference machine (Intel Core i5-1240P, CPU only, 2 PyTorch threads and 4 OpenCV threads), using a real hazy street frame cropped to the ROI size, averaged over 40 runs after a 3-run warm-up. The budget for 30 FPS is 33 ms per frame.`),
  tbl('tbl:perf', 'Dehazing cost per ROI (milliseconds per frame)', ['ROI size', 'DCP only', 'DCP + Tiny CNN', 'Within 33 ms budget (with CNN)'], [22, 20, 24, 34],
    perf.map((r) => [`${r.w} x ${r.h}`, r.dcp.toFixed(1), r.cnn.toFixed(1), r.cnn <= 33 ? 'Yes' : 'No for one camera at 30 FPS on its own'])),
  p('Because processing runs only on the motion ROI and the classical stages are downscaled, typical surveillance motion regions (a person or a vehicle) fall in the smaller rows. A very large ROI can exceed one frame\'s time budget, which lowers the processed frame rate of that camera but does not stop capture, because the live reader drops stale frames. This measurement covers the dehazing step only; whole-system frame rate with many simultaneous cameras was not benchmarked.'),
];
