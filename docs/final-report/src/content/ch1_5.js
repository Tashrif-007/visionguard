const { h1, h2, h3, p, ul, ol, code, note, tbl, fig, figrow } = require('./h');
const UC = 'assets/trim/';
const AC = 'assets/trim/';
const DG = 'assets/diagrams/';

module.exports = [
  // ------------------------------------------------------------------ 1
  h1('Project Overview'),
  h2('Project Title'),
  p('VisionGuard: AI-Assisted Visibility Enhancement and Incident Retrieval for Smart CCTV Surveillance'),
  h2('Problem Statement'),
  p('CCTV footage from surveillance cameras degrades sharply in haze, smog, and fog, which is exactly when security teams need it most. Visibility loss during these conditions can hide intrusions, accidents, and other events a surveillance system exists to catch. Modern image dehazing research has moved toward end-to-end deep learning models that produce strong results, but those models are typically too heavy to run on the CPU-only hardware found in most guard rooms and edge installations, and running full-frame enhancement on every frame of a live feed is wasteful when most of a frame is static background with nothing happening in it.'),
  p('VisionGuard addresses this by combining a physics-based dehazing model (the Dark Channel Prior) with a lightweight CNN that only refines the prior\'s transmission estimate, and by restricting all of that computation to the small region of a frame where motion was actually detected. This keeps the system real-time, explainable, and deployable without a GPU. A second problem follows from the first: a guard cannot watch every feed continuously, so the system must also record what happened, let the guard find it again quickly, and show the footage itself rather than a single still.'),
  h2('Objectives'),
  ul(
    'Recover clear visibility in hazy or smoggy CCTV footage without requiring specialized hardware.',
    'Keep the dehazing pipeline CPU-friendly and capable of real-time (30 FPS target) operation by only processing regions flagged by motion detection, not entire frames.',
    'Preserve a hybrid, explainable architecture (physics prior plus a lightweight CNN refinement) rather than an opaque end-to-end deep learning model.',
    'Automatically log every enhanced event (timestamp, snapshot, video clip, event type, ROI coordinates and size) so operators have a retrievable record without manual effort.',
    'Reduce false events with per-camera detection zones, arming schedules, and a minimum motion duration, without claiming to classify what moved.',
    'Let operators retrieve past events through a chronological timeline, a natural-language search interface, and an analytics dashboard.',
    'Run several cameras at once, each starting and stopping independently.',
    'Restrict system access to authenticated operator and administrator accounts, with no open self-registration.'
  ),
  h2('Scope'),
  h3('In scope (MVP)'),
  ul(
    'Live webcam / IP camera feed ingestion, plus uploaded video file processing, with several sources running concurrently.',
    'Motion detection that skips dehazing entirely when no motion is present.',
    'ROI extraction from the motion mask, so only the suspicious region is processed.',
    'The hybrid DCP + Tiny CNN dehazing pipeline (dark channel, Top-K atmospheric light, coarse transmission, CNN refinement, radiance recovery, gamma correction, merge back into frame).',
    'Detection zones (include and exclude polygons) and weekly arming schedules per camera.',
    'Event logging with timestamp, snapshot image, video clip, event type, ROI coordinates and ROI size relative to the frame.',
    'A timeline / event browser with an evidence inspector (video clip and snapshot).',
    'Natural language event search (for example "any motion last night?") backed by the Claude API.',
    'An event analytics dashboard (per day, per hour, weekday-by-hour heatmap, per camera, motion size).',
    'JWT-based authentication with admin-seeded accounts, profile and password self-service, and admin account management.'
  ),
  h3('Out of scope (future work, not implemented)'),
  ul(
    'Object detection and intrusion classification: the system logs "motion" and does not claim to recognise people, vehicles, or intruders.',
    'ONNX Runtime inference.',
    'FFmpeg integration.',
    'Temporal transmission smoothing across frames.',
    'Alert delivery (email, webhook, messaging) and a persistent camera registry.'
  ),
  h2('Deliverables'),
  ul(
    'A FastAPI backend implementing the motion-gated, ROI-based hybrid dehazing pipeline.',
    'A trained Tiny CNN transmission-refinement model with saved weights (`backend/weights/tiny_cnn.pth`) and the training code in `training/`.',
    'A PostgreSQL-backed store for users, video sources, events, zones and schedules, with repository-layer access.',
    'A JWT authentication system with admin-seeded accounts and operator account management.',
    'A React + TypeScript dashboard for live multi-camera viewing, zone and schedule configuration, event timeline with video evidence, natural-language search, analytics, and account pages.',
    'An automated test suite (40 unit tests) and a scripted API acceptance run (37 cases) against a live server and real PostgreSQL.',
    'This final report, including the software design document, test documentation and user manual.'
  ),
  h2('Changes Since the Midterm Report'),
  p('The midterm report described a single-camera MVP. The following scope and design changes were made afterwards. They are reflected throughout this report.'),
  tbl('tbl:changes', 'Changes made after the midterm report', ['Area', 'Midterm', 'Final'], [18, 36, 46], [
    ['Cameras', 'Multi-camera listed as out of scope; one active source', 'Any number of concurrent sources through a `CapturePool`; each starts and stops independently'],
    ['Accounts', 'Username login; admin creates operators', 'Email login, `is_active` flag, profile and password pages, admin activate/deactivate with self-lockout and last-admin protection'],
    ['Snapshots', 'Public static `/snapshots` mount', 'Authenticated `GET /events/{id}/snapshot` endpoint; static mount removed'],
    ['Performance', 'Dehazing cost grew with ROI size; capture lag unbounded', 'ROI area cap, downscaled classical stages, guided upsample, one-slot live frame reader, throttled preview, capped CPU threads'],
    ['False events', 'Every motion frame could log an event', 'Minimum motion duration, per-camera zones and schedules, ROI area ratio stored per event'],
    ['Evidence', 'Single snapshot per event', 'Snapshot plus a pre/post-roll video clip in WebM'],
    ['Review', 'Timeline and text search', 'Added the evidence inspector with video and a five-chart analytics dashboard'],
  ]),

  // ------------------------------------------------------------------ 2
  h1('Requirements Analysis'),
  h2('Functional Requirements'),
  ul(
    '**FR-1:** The system will allow an operator to start a live feed from a webcam or IP camera, or upload a recorded video file for processing.',
    '**FR-2:** The system will allow an operator to stop an active feed at any time and view the latest processed frame while a feed is running.',
    '**FR-3:** The system will continuously monitor incoming frames for motion and skip the dehazing pipeline entirely when no motion is detected.',
    '**FR-4:** When motion is detected, the system will extract only the region of interest (ROI) containing that motion rather than processing the full frame.',
    '**FR-5:** The system will dehaze the extracted ROI using the Dark Channel Prior for an initial transmission estimate, refine that estimate with a Tiny CNN, and reconstruct the clean region via the atmospheric scattering model before merging it back into the original frame.',
    '**FR-6:** The system will automatically log dehazing events with their timestamp, a snapshot image, the event type, the ROI coordinates and the ROI area as a share of the frame.',
    '**FR-7:** The system will allow an operator to browse logged events in chronological order on an Events page, showing each event\'s snapshot and details.',
    '**FR-8:** The system will allow an operator to enter a plain-English query (for example "any motion last night?") that is parsed into structured filters and used to retrieve matching logged events; if no time range can be determined, the system shall return all events rather than failing.',
    '**FR-9:** The system will require authentication (JWT) for every endpoint except login; an admin account is seeded on first startup, and only the admin can create operator accounts.',
    '**FR-10:** The system will run several camera sources concurrently, and each source can be started and stopped independently of the others.',
    '**FR-11:** The system will let an operator define include and exclude detection zones per camera; motion outside the active zones shall not create events, and changes shall apply to the running feed without a restart.',
    '**FR-12:** The system will let an operator set a weekly arming schedule per camera; outside the schedule the camera keeps streaming but detection and event logging are suspended.',
    '**FR-13:** The system will log an event only after motion has persisted for a configurable number of consecutive frames and a per-camera cooldown has elapsed.',
    '**FR-14:** The system will record a short video clip (pre-roll and post-roll) for every logged event and let the operator play it in the browser.',
    '**FR-15:** The system will provide an analytics view of logged events (per day, per hour, weekday-by-hour, per camera, motion size) filterable by time range and camera.',
    '**FR-16:** The system will let any user edit their own name, email and password, and let the admin list accounts, deactivate or reactivate them, and delete events.'
  ),
  h2('Non-functional Requirements'),
  ul(
    '**Performance:** The pipeline must sustain a target of 30 FPS on CPU-only hardware by dehazing only the motion ROI, not the full frame, and by skipping the pipeline entirely on static frames.',
    '**Security:** Passwords are hashed with bcrypt and never stored or logged in plaintext; tokens are signed and verified with JWT; snapshots and clips are served only through authenticated endpoints with a path-traversal guard.',
    '**Reliability:** Every module raises meaningful, typed exceptions instead of silently swallowing errors, and model weights are loaded once at startup rather than per request. A missing weights file degrades to pure DCP instead of crashing.',
    '**Scalability:** Business logic is isolated in service modules with dependency-injected pipeline and camera state (no global mutable state), so additional camera sources need no change to the core pipeline.',
    '**Maintainability:** The codebase follows a strict layered architecture (routers, controllers, services, repositories) with Pydantic schemas for every request and response and no ORM models leaking into the API layer.',
    '**Usability:** Operators work in a single dashboard for live viewing, timeline browsing, search and analytics, with all server state managed through React Query so the UI reflects backend state without manual refresh logic.',
    '**Resource use:** Per-camera memory for clip buffering is bounded by `CLIP_PRE_SECONDS`, `CLIP_FPS` and `CLIP_MAX_WIDTH`; the live reader keeps one frame so latency does not grow when processing falls behind.'
  ),
  h2('Stakeholders'),
  ul(
    '**Operators:** security guards, building surveillance operators, university campus surveillance staff, and warehouse or parking-lot monitoring teams who run live feeds, review events, and search the timeline day to day.',
    '**Administrator:** manages operator accounts (the only account-creation path in the system), can delete events, and has full access to all operator-level functionality.',
    '**Supervisor and evaluators:** review the design, the implementation quality and the demonstrated behaviour.'
  ),

  // ------------------------------------------------------------------ 3
  h1('System Modeling'),
  p('Scenario-based modeling is used here to depict how VisionGuard AI behaves under real usage scenarios. A use case diagram visually represents how the system interacts with its actors to achieve specific goals, showing the relationships between use cases (system functionalities) and the actors (users or systems) that trigger them. The use case diagrams are broken into a Level 0 overview, a Level 1 module breakdown, and one diagram for each module.'),
  h2('Use Case Diagrams'),
  p('Level 0 (use case ID 0, "VisionGuard AI: Detect, Enhance and Search", primary actors Admin and Operator) shows the system and its two human actors. Level 1 decomposes it into seven modules, which are detailed one by one in the following figures.'),
  figrow(
    fig('fig:uc0', UC + 'visionguard use case level 0.png', 'Use case diagram, level 0', 100),
    fig('fig:uc1', UC + 'visionguard use case level 1.png', 'Use case diagram, level 1', 100)
  ),
  p('Levels 1.1 and 1.2 cover user management (actors: Admin, Operator) and camera and feed management (actor: Operator). Levels 1.3, 1.4 and 1.5 are performed by the system itself through the capture worker: motion detection and ROI extraction, the hybrid dehazing pipeline, and event logging. Levels 1.6 and 1.7 cover the timeline and event browser and the natural-language event search, whose secondary actor is the LLM API.'),
  figrow(
    fig('fig:uc11', UC + 'visionguard use case level 1.1.png', 'Level 1.1: user management', 100),
    fig('fig:uc12', UC + 'visionguard use case level 1.2.png', 'Level 1.2: camera and feed management', 100)
  ),
  figrow(
    fig('fig:uc13', UC + 'visionguard use case level 1.3.png', 'Level 1.3: motion detection and ROI extraction', 100),
    fig('fig:uc14', UC + 'visionguard use case level 1.4.png', 'Level 1.4: hybrid dehazing pipeline', 100)
  ),
  figrow(
    fig('fig:uc15', UC + 'visionguard use case level 1.5.png', 'Level 1.5: event logging', 100),
    fig('fig:uc16', UC + 'visionguard use case level 1.6.png', 'Level 1.6: timeline and event browser', 100)
  ),
  figrow(
    fig('fig:uc17', UC + 'visionguard use case level 1.7.png', 'Level 1.7: natural-language event search', 100)
  ),
  h2('Use Cases Added After the Midterm'),
  p('Three modules were added after the diagrams above were drawn. They are specified here in tabular form and modelled as activities in the next section.'),
  tbl('tbl:uc_new', 'Use case specifications for the added modules', ['Item', 'UC 1.8 Zones and Schedules', 'UC 1.9 Event Video Clips', 'UC 1.10 Event Analytics'], [16, 28, 28, 28], [
    ['Primary actor', 'Operator', 'System (capture worker); Operator views', 'Operator'],
    ['Pre-condition', 'Operator is signed in and the camera is active', 'Camera armed; motion persisted for the minimum frames', 'Operator is signed in; events exist'],
    ['Main flow', 'Open Configure on a tile; draw include/exclude polygons or set weekdays and a time window; save', 'Pre-roll frames copied; post-roll appended; clip encoded to WebM and attached to the event; operator plays it in the evidence inspector', 'Choose a time range and camera; the page shows totals, per-day and per-hour charts, a weekday-by-hour heatmap, per-camera and motion-size breakdowns'],
    ['Alternative flows', 'Invalid polygon or equal start/end time: error toast, nothing saved', 'Source ends before post-roll completes: clip is flushed with the frames so far. Encoder cannot open: clip stays unavailable and the snapshot is shown', 'No events in range: empty-state message'],
    ['Post-condition', 'Zones and schedule stored; the running feed applies them on the next frame', 'Event has a clip file under `clips/`; deleting the event deletes the file', 'No data is changed'],
    ['Requirements', 'FR-11, FR-12', 'FR-14', 'FR-15'],
  ]),
  h2('Activity Diagrams'),
  p('An activity diagram models the flow of control within a use case as a sequence of actions and decision points, capturing branching logic, loops, and parallel outcomes that a use case diagram alone cannot show. The first diagram traces the per-frame processing loop as a single end-to-end flow; the following ones break it down per module to mirror the use case breakdown above. The last two were added for the features introduced after the midterm.'),
  fig('fig:act0', AC + 'visionguard activity.png', 'Activity diagram: per-frame processing loop (overall)', 82),
  figrow(
    fig('fig:act11', AC + 'visionguard activity 1.1.png', 'Level 1.1: user management', 100),
    fig('fig:act12', AC + 'visionguard activity 1.2.png', 'Level 1.2: camera and feed management', 100)
  ),
  figrow(
    fig('fig:act13', AC + 'visionguard activity 1.3.png', 'Level 1.3: motion detection and ROI extraction', 100),
    fig('fig:act14', AC + 'visionguard activity 1.4.png', 'Level 1.4: hybrid dehazing pipeline', 100)
  ),
  figrow(
    fig('fig:act15', AC + 'visionguard activity 1.5.png', 'Level 1.5: event logging', 100),
    fig('fig:act16', AC + 'visionguard activity 1.6.png', 'Level 1.6: timeline and event browser', 100)
  ),
  figrow(
    fig('fig:act17', AC + 'visionguard activity 1.7.png', 'Level 1.7: natural-language event search', 100),
    fig('fig:act18', DG + 'act_zones.png', 'Added: configuring zones and schedules', 100)
  ),
  fig('fig:act19', DG + 'act_review.png', 'Added: reviewing an event with video evidence', 52),

  // ------------------------------------------------------------------ 4
  h1('Data and Information Modeling'),
  p('The persistent domain model has five entities. A `User` creates many `VideoSource` records (1:N); a `VideoSource` generates many `Event` records (1:N), owns many `CameraZone` records (1:N) and at most one `CameraSchedule` (1:1).'),
  fig('fig:erd', DG + 'erd.png', 'Entity-relationship diagram of the VisionGuard database', 52),
  tbl('tbl:users', 'users table', ['Attribute', 'Data type', 'Key / constraints'], [25, 22, 53], [
    ['id', 'INTEGER', 'Primary key, autoincrement'],
    ['name', 'VARCHAR(64)', 'Not null'],
    ['email', 'VARCHAR(255)', 'Unique, indexed, not null (the login identifier)'],
    ['password_hash', 'VARCHAR(128)', 'Not null (bcrypt hash, never plaintext)'],
    ['role', 'VARCHAR(20)', 'Not null ("admin" or "operator")'],
    ['is_active', 'BOOLEAN', 'Not null, default true; inactive users cannot sign in'],
    ['created_at', 'DATETIME', 'Not null, server default now'],
  ]),
  tbl('tbl:sources', 'video_sources table', ['Attribute', 'Data type', 'Key / constraints'], [25, 22, 53], [
    ['id', 'INTEGER', 'Primary key, autoincrement'],
    ['name', 'VARCHAR(255)', 'Not null'],
    ['source_type', 'VARCHAR(20)', 'Not null (webcam, ip_camera or upload)'],
    ['source_uri', 'TEXT', 'Not null (device index, stream URL or uploaded file path)'],
    ['is_active', 'BOOLEAN', 'Not null, default false'],
    ['created_by', 'INTEGER', 'Foreign key to users.id, nullable'],
    ['created_at', 'DATETIME', 'Not null, server default now'],
  ]),
  tbl('tbl:events', 'events table', ['Attribute', 'Data type', 'Key / constraints'], [25, 22, 53], [
    ['id', 'INTEGER', 'Primary key, autoincrement'],
    ['source_id', 'INTEGER', 'Foreign key to video_sources.id, not null'],
    ['event_type', 'VARCHAR(30)', 'Not null (currently "motion")'],
    ['timestamp', 'DATETIME', 'Not null, stored as naive UTC'],
    ['image_path', 'TEXT', 'Not null, path of the snapshot JPEG'],
    ['roi_x, roi_y, roi_width, roi_height', 'INTEGER', 'Not null, pixel box of the motion region'],
    ['roi_area_ratio', 'DOUBLE PRECISION', 'Nullable, ROI area divided by frame area'],
    ['clip_path', 'TEXT', 'Nullable, path of the WebM clip (may not exist yet while recording)'],
    ['frame_number', 'INTEGER', 'Nullable'],
    ['created_at', 'DATETIME', 'Not null, server default now'],
  ]),
  tbl('tbl:zones', 'camera_zones table', ['Attribute', 'Data type', 'Key / constraints'], [25, 22, 53], [
    ['id', 'INTEGER', 'Primary key, autoincrement'],
    ['source_id', 'INTEGER', 'Foreign key to video_sources.id, indexed, not null'],
    ['name', 'VARCHAR(64)', 'Not null'],
    ['mode', 'VARCHAR(10)', 'Not null ("include" or "exclude")'],
    ['points', 'JSON', 'Not null, list of normalized [x, y] pairs in 0..1 so zones are resolution independent'],
    ['created_at', 'DATETIME', 'Not null, server default now'],
  ]),
  tbl('tbl:schedules', 'camera_schedules table', ['Attribute', 'Data type', 'Key / constraints'], [25, 22, 53], [
    ['id', 'INTEGER', 'Primary key, autoincrement'],
    ['source_id', 'INTEGER', 'Foreign key to video_sources.id, unique, not null'],
    ['enabled', 'BOOLEAN', 'Not null'],
    ['weekdays', 'JSON', 'Not null, list of 0 (Monday) to 6 (Sunday)'],
    ['start_time, end_time', 'TIME', 'Not null; an end earlier than the start spans midnight'],
  ]),
  p('Events are indexed on (source_id, timestamp) and (event_type, timestamp) to keep timeline browsing, analytics and natural-language search filters fast as the event log grows. Schema changes to tables that already exist are applied by idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at startup, because `create_all` only creates missing tables.'),

  // ------------------------------------------------------------------ 5
  h1('AI Model and Dataset Description'),
  h2('Role of the Network'),
  p('The Tiny CNN transmission-refinement model is trained on two complementary data sources rather than a single fixed dataset, since VisionGuard AI\'s neural component only needs to learn how to correct the Dark Channel Prior\'s errors, not to generate images from scratch. It takes three channels (grayscale ROI, dark channel, coarse transmission) and returns a refined transmission map through four 3x3 convolutions (16, 32, 16, 1 channels) with ReLU activations and a final sigmoid. It has 9,857 parameters.'),
  h2('Dataset'),
  ul(
    '**Synthetic haze generator.** A random textured clean scene and a smooth, random ground-truth transmission field are combined through the atmospheric scattering model (I = J·t + A·(1−t)) to synthesize a hazy image. The network input channels are computed with the project\'s actual DCP implementation, so the CNN learns to correct that specific estimator\'s real errors rather than an idealized one.',
    '**REVIDE real-world paired haze dataset (CVPR 2021).** The same indoor scenes recorded with and without machine-generated haze, giving pixel-aligned hazy and clear pairs for training and validation on real haze.',
    '**Number of samples.** 3,000 synthetic samples per epoch by default (generated deterministically per RNG seed and index), combined with 42 REVIDE training scene folders (1,697 hazy images) and 6 REVIDE test scene folders (284 hazy images).',
    '**Features.** A 3-channel stack of grayscale hazy ROI, dark channel and coarse DCP transmission.',
    '**Labels.** There is no classification label; the target is a refined transmission map. For synthetic samples the true transmission is known; for REVIDE pairs the coarse DCP transmission is used as an anchor. Training is driven mainly by a reconstruction loss (L1 between the image recovered with the predicted transmission and the clean image) plus a small L1 term against the true transmission on synthetic data.',
    '**Preprocessing and training.** 96x96 patches, a 15-pixel DCP window, inputs and targets in [0, 1] float32, batch size 16, Adam with learning rate 1e-3 halved every 8 epochs, 15 epochs by default; the best-validation-loss weights are saved to `backend/weights/tiny_cnn.pth`.'
  ),
  h2('Findings'),
  ul(
    'Training on a transmission-L1 loss alone made the end-to-end output worse. The top-K atmospheric light is underestimated on scenes without bright sky, and DCP\'s underestimated transmission was accidentally compensating. Training through a differentiable mirror of the radiance recovery step, using the estimated atmospheric light, fixed this.',
    'On held-out REVIDE pairs the reconstruction L1 error was 0.089 with the CNN against 0.122 for DCP alone (about 27% lower), and block halos from the patch-based dark channel were visibly reduced.',
    '**Known limitation.** REVIDE is indoor-only. On an outdoor dusk clip the CNN output can over-darken sky and glow around bright lights, so DCP alone sometimes looks better there. Outdoor paired data, residual transmission prediction and a larger receptive field are the next improvements.'
  ),
];
