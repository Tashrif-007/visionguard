const { h1, h2, h3, p, ul, ol, code, note, tbl, fig, figrow } = require('./h');

module.exports = [
  // ------------------------------------------------------------------ 10
  h1('User Manual'),
  h2('Introduction'),
  p('This manual explains how to install VisionGuard AI and how operators and administrators use it day to day. Operators watch cameras, configure where and when detection runs, and review events. Administrators can also manage accounts and delete events.'),
  h2('System Requirements'),
  tbl('tbl:req', 'System requirements', ['Item', 'Requirement'], [28, 72], [
    ['Operating system', 'Linux, macOS or Windows able to run Python 3.11+ and Node.js 18+'],
    ['Processor', 'A modern multi-core CPU; no GPU is needed'],
    ['Memory', '4 GB minimum; more for many simultaneous cameras (each camera buffers a few seconds of video for clips)'],
    ['Database', 'PostgreSQL 14 or newer'],
    ['Browser', 'A current version of Chrome, Edge or Firefox'],
    ['Optional', 'An Anthropic API key for natural-language search'],
  ]),
  h2('Installation'),
  h3('1. Get the source code'),
  code('git clone https://github.com/Tashrif-007/visionguard.git\ncd visionguard'),
  h3('2. Backend'),
  code('python3 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\ncreatedb visionguard\ncp .env.example .env'),
  p('Edit `.env` and set at least the `POSTGRES_*` values, a long random `JWT_SECRET_KEY`, and `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `ADMIN_NAME` and `ANTHROPIC_API_KEY` are optional. `MODEL_PATH` already points at the supplied weights. Then start the API from the repository root:'),
  code('uvicorn backend.main:app --port 8000'),
  p('On first start the tables are created and an administrator account is created from the `ADMIN_*` values. Interactive API documentation is at `http://localhost:8000/docs`.'),
  h3('3. Frontend'),
  code('cd frontend\nnpm install\ncp .env.example .env   # VITE_API_URL=http://localhost:8000\nnpm run dev'),
  p('Open `http://localhost:5173`. For a production deployment run `npm run build` and serve the `dist` folder from any static web server.'),
  h3('4. Verify the installation'),
  ul('Run `pytest` from the repository root; all unit tests should pass.', 'Open the application and sign in with the administrator email and password from `.env`.'),
  note('There is no packaged installer. The steps above are the supported installation procedure.'),

  h2('Signing In and Out'),
  ol(
    'Open the application and choose **Sign in to monitor**.',
    'Enter your email and password and press **Sign in** ({{fig:ui_login}}). A wrong password shows an error and keeps you on the page ({{fig:ui_login_error}}).',
    'To sign out open the user menu at the top right and choose **Sign out**. If your session expires you are returned to the sign-in page automatically.'
  ),
  p('Accounts cannot be created from the sign-in page. Ask an administrator to create an operator account for you.'),

  h2('Live Monitoring'),
  p('**Live Monitoring** ({{fig:ui_dash}}) shows one tile for every active camera. The processed frame is shown with a green box around the region where motion was found; inside that box the haze has been removed.'),
  h3('Adding a camera'),
  ol(
    'Press **Add camera** at the top right of the dashboard ({{fig:ui_add}}).',
    'Optionally type a name.',
    'In **Source**, enter a webcam index (for example `0`), a stream address (for example `rtsp://camera-address/stream`), or a path to a video file on the server.',
    'Press **Add camera**. The new tile appears within a few seconds. If the source cannot be opened an error message explains why and nothing is started.'
  ),
  h3('Uploading a video'),
  p('Press **Upload video** in the same dialog and choose a video file. The file is uploaded, played at its natural speed and processed like a live camera. The tile disappears when the video ends.'),
  h3('Working with tiles'),
  ul(
    'Use the **camera search box** to find a tile by name, and the **Grid / Focus** buttons to change the layout.',
    '**Configure** opens detection zones and schedule for that camera.',
    '**Remove** stops that source. Other cameras keep running.',
    'A **Disarmed** badge means the camera is outside its schedule and is not detecting. A **zones** badge shows how many zones the camera has.',
    'The **Recent events** strip at the bottom shows the latest events; click one to open it.'
  ),

  h2('Detection Zones'),
  p('Zones tell the system where to look. Use them to ignore trees, roads, sky or reflections, or to watch only a doorway.'),
  ol(
    'Press **Configure** on a tile and stay on the **Zones** tab ({{fig:ui_zones}}).',
    'Choose **Exclude** (ignore this area) or **Include** (only watch this area).',
    'Click on the picture to place the corners of an area. Place at least three points.',
    'Press **Finish zone**. The area is drawn red (exclude) or green (include) and added to the list.',
    'Repeat for more zones. You can rename a zone in the list or delete it with the bin icon.',
    'Press **Save zones**. The running camera uses the new zones straight away; you do not need to restart it.'
  ),
  p('If you define any include zone, only the include zones are watched, minus any exclude zones inside them. If you define only exclude zones, the whole picture is watched except those areas. Zones are saved with the camera: if you remove a camera and add it again with the same source, its zones come back.'),

  h2('Arming Schedules'),
  ol(
    'Press **Configure** and open the **Schedule** tab ({{fig:ui_sched}}).',
    'Tick **Use a schedule** (if it is not ticked the camera is always armed).',
    'Select the weekdays.',
    'Set **Armed from** and **Until**. If the end time is earlier than the start, the window runs past midnight: for example Monday 22:00 to 06:00 also covers early Tuesday morning.',
    'Press **Save schedule**.'
  ),
  p('Outside the window the camera keeps streaming but is **disarmed**: no motion is detected and no events are recorded. The schedule uses the timezone set by the administrator in `SCHEDULE_TIMEZONE`.'),

  h2('Reviewing Events'),
  p('Open **Events and Timeline** ({{fig:ui_clip}}). Events are grouped by day, newest first. Each card shows a thumbnail, the event type, a **Clip** badge when a video exists, the time, the region size and position, and the source.'),
  ul(
    'Click a card to open it in the **Evidence inspector**.',
    'The **Video clip** tab plays a few seconds before and after the event with the motion box visible. Use the controls to pause or seek. If the clip is not ready yet the inspector says it is still being recorded and loads it automatically.',
    'The **Snapshot** tab ({{fig:ui_snap}}) shows the still frame with the region marked. **Open full size** opens the image in a new tab.',
    'The details list shows the event type, time, source, region, how much of the frame the motion covers, and the frame number.'
  ),
  p('Events are recorded as **motion**. VisionGuard does not decide whether the motion is a person, vehicle or animal; review the video to decide.'),

  h2('Searching Events'),
  p('Type a plain-English question in the search box on the Events page, for example "any motion last night?" or "events this morning", and press Enter. The interpreted time range appears as chips above the results. If the system cannot work out a time range, or search by language is not configured, it shows all events instead of an error.'),

  h2('Event Analytics'),
  p('Open **Event Analytics** ({{fig:ui_analytics}}). Choose a time range (last 24 hours, 7 days, 30 days or all time) and optionally one camera. The page shows the total number of events, the busiest hour and the most active camera, charts of events per day and per hour of day, a weekday-by-hour heatmap of the busiest times, events per camera, and how large the motion was relative to the frame. Hover over a bar or a heatmap cell for its exact value. Use the heatmap to choose schedules and zones.'),

  h2('Your Profile'),
  p('Open **Profile** from the user menu ({{fig:ui_profile}}). On **Details** you can change your name and email address (your email is also your sign-in name). On **Security** you can change your password by entering the current password and a new one of at least 8 characters.'),

  h2('Administration'),
  p('Administrators have an **Admin Console** entry ({{fig:ui_admin}}).'),
  ul(
    '**Create operator account:** enter a name, an email and a password and press **Create operator**. Share the password with the person securely.',
    '**Deactivate or reactivate** an account from the user table. A deactivated person can no longer sign in, and their history is kept. You cannot deactivate yourself, and the last active administrator cannot be deactivated.',
    '**Delete events** from the Events tab. Deleting an event also deletes its snapshot and clip.'
  ),

  h2('Tips for Good Results'),
  ul(
    'Exclude swaying trees, flags, reflective glass and roads you do not need, so they do not create events.',
    'Use a schedule to silence cameras during hours when activity is expected.',
    'Very large moving regions take longer to dehaze. If a feed lags, reduce the camera resolution or add exclude zones.',
    'Short flickers are ignored by design; motion must last about half a second to be recorded. Administrators can change this with `MOTION_MIN_FRAMES`.'
  ),
  h2('Troubleshooting'),
  tbl('tbl:trouble', 'Common problems', ['Problem', 'Likely cause', 'What to do'], [28, 34, 38], [
    ['"Cannot open video source"', 'Wrong address, camera offline, or the file path does not exist on the server', 'Check the address, test it in a media player, and make sure the server can reach it'],
    ['The tile shows "Waiting for frames"', 'The source has just started, or has ended', 'Wait a few seconds; a video file disappears when it ends'],
    ['No events appear', 'Camera disarmed, motion outside include zones, or motion too short', 'Check the Disarmed badge, the zones and the schedule; lower `MOTION_MIN_FRAMES` if needed'],
    ['Too many events', 'Foliage, shadows or lighting changes', 'Add exclude zones; raise `MOTION_MIN_FRAMES` or `MOTION_MIN_AREA`'],
    ['Clip says "unavailable"', 'The encoder could not create the file', 'Check the server log; the snapshot is still available'],
    ['Search returns every event', 'No time could be understood, or no API key is set', 'Rephrase with a time such as "yesterday", or ask the administrator to set `ANTHROPIC_API_KEY`'],
    ['Signed out unexpectedly', 'The token expired or the account was deactivated', 'Sign in again; contact an administrator if sign-in fails'],
    ['Schedules or analytics look shifted', 'Server timezone differs from the operators\'', 'Ask the administrator to set `SCHEDULE_TIMEZONE`; event times on screen follow the browser\'s timezone'],
  ]),

  // ------------------------------------------------------------------ 11
  h1('Project Management, Repository and Deliverables'),
  h2('Timeline'),
  fig('fig:gantt', 'assets/trim/visionguard_gantt_chart.png', 'Gantt chart of the VisionGuard progress timeline', 70),
  h2('Version Control'),
  p('The source code is kept in a public Git repository:'),
  p('**https://github.com/Tashrif-007/visionguard**'),
  ul(
    'Two long-lived branches: `main` for stable releases and `dev` for integration.',
    'Work is done on short-lived feature branches (for example `feature/authentication`, `feature/nlp-search`, `feature/frontend-dashboard`) that are merged into `dev` with explicit merge commits.',
    'Commit messages use a short type prefix such as `feat:` and `docs:`.',
    '`.env`, virtual environments, uploads, snapshots and clips are excluded through `.gitignore`.'
  ),
  note('The repository must contain the final work before submission: the zone, schedule, clip and analytics features, the updated tests, the report generator and this report were still uncommitted local changes when this report was prepared, and must be committed and pushed so the public repository matches what is demonstrated.'),
  h2('Installer'),
  p('Not applicable: VisionGuard is installed from source as described in the User Manual. A container image (Docker) that packages the backend, frontend and database is a reasonable future deliverable.'),
  h2('Compliance with the Final Report Requirements'),
  tbl('tbl:comply', 'Where each required item is covered', ['Required item', 'Covered in'], [52, 48], [
    ['Design classes of the problem domain', 'Chapter 6, Design Classes'],
    ['Persistent data sources (databases and files) and their classes', 'Chapter 4 and Chapter 6, Persistent Data Sources'],
    ['Behavioural representations of classes and components', 'Chapter 6, Behavioural Representations and Component Design Detail'],
    ['Deployment diagrams', 'Chapter 6, Deployment'],
    ['Refactoring and alternatives', 'Chapter 6, Refactoring and Alternatives Considered'],
    ['Interface objects and actions', 'Chapter 7, Interface Objects and Operations'],
    ['Events (user actions) that change interface state', 'Chapter 7, Events That Change the Interface State'],
    ['Each interface state as it looks to the user', 'Chapter 7, Interface States as They Appear to the User'],
    ['Testing approach, pass/fail criteria, risks and contingencies', 'Chapter 9'],
    ['Test cases with detailed outcomes', 'Chapter 9, Unit Test Results and API Acceptance Test Results'],
    ['User manual', 'Chapter 10'],
    ['URL of the public repository', 'Chapter 11, Version Control'],
    ['Installer (if applicable)', 'Chapter 11, Installer'],
    ['Earlier documents (requirements, use cases, activity diagrams, data model, dataset, test plan, timeline)', 'Chapters 1 to 5 and Chapter 11'],
  ]),

  // ------------------------------------------------------------------ 12
  h1('Conclusion and Future Work'),
  p('VisionGuard demonstrates that useful visibility enhancement and incident retrieval are possible on ordinary CPU hardware by combining a physical haze model with a tiny learned correction and by spending computation only where motion occurs. The final system supports several concurrent cameras, per-camera zones and schedules, event snapshots and video clips, a timeline with natural-language search, an analytics dashboard, and a role-based account system, all behind a layered and tested code base.'),
  p('The design deliberately stays honest about what it knows. Events are "motion" events; the system does not claim to recognise intruders. The Tiny CNN only refines transmission, and the system degrades to pure DCP if the weights are absent. The Claude API is only used to parse search queries, and search works without it.'),
  h2('Limitations'),
  ul(
    'The CNN was trained on synthetic and indoor paired data and can over-darken sky or glow around lights in outdoor dusk scenes.',
    'No object classification, so lighting changes and foliage can still create events inside active zones.',
    'Whole-system throughput with many cameras and sustained load was not benchmarked, and live-Claude query parsing was not exercised in the final test run.',
    'No automatic retention policy for snapshots, clips and uploads.',
    'Zones and schedules attach to a camera source, so a new source with a different URI starts with no zones.'
  ),
  h2('Future Work'),
  ul(
    'A persistent camera registry page, so cameras are registered once and started and stopped with their settings.',
    'Alert rules and notifications by email, webhook or messaging when events match a rule.',
    'Event review workflow (new, reviewed, flagged, notes) and CSV or PDF export.',
    'A haze analytics module: a per-camera visibility score over time and a raw versus dehazed comparison, optionally enabling dehazing only when haze is present.',
    'Outdoor paired training data, residual transmission prediction and temporal smoothing of the transmission map.',
    'Object detection and intrusion classification, ONNX Runtime inference and FFmpeg-based streaming, once the CPU budget allows.',
    'Camera health monitoring (frame rate, latency, offline detection), an audit log, retention policies and a Docker-based installer.'
  ),

  // ------------------------------------------------------------------ refs + appendix
  h1('References', { numbered: false }),
  ol(
    'K. He, J. Sun and X. Tang, "Single image haze removal using dark channel prior," IEEE Transactions on Pattern Analysis and Machine Intelligence, vol. 33, no. 12, pp. 2341-2353, 2011.',
    'S. G. Narasimhan and S. K. Nayar, "Vision and the atmosphere," International Journal of Computer Vision, vol. 48, no. 3, pp. 233-254, 2002.',
    'K. He, J. Sun and X. Tang, "Guided image filtering," IEEE Transactions on Pattern Analysis and Machine Intelligence, vol. 35, no. 6, pp. 1397-1409, 2013.',
    'Z. Zivkovic, "Improved adaptive Gaussian mixture model for background subtraction," in Proc. International Conference on Pattern Recognition (ICPR), vol. 2, pp. 28-31, 2004.',
    'X. Zhang et al., "Learning to restore hazy video: A new real-world dataset and a new method," in Proc. IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 2021 (the REVIDE dataset).',
    'M. Jones, J. Bradley and N. Sakimura, "JSON Web Token (JWT)," RFC 7519, IETF, 2015.',
    'N. Provos and D. Mazieres, "A future-adaptable password scheme," in Proc. USENIX Annual Technical Conference, 1999.',
    'A. Paszke et al., "PyTorch: An imperative style, high-performance deep learning library," in Advances in Neural Information Processing Systems 32 (NeurIPS), 2019.',
    'G. Bradski, "The OpenCV Library," Dr. Dobb\'s Journal of Software Tools, 2000.',
    'FastAPI, SQLAlchemy, React, Vite, TanStack Query and Anthropic API documentation (official project websites).'
  ),
  h1('Appendix A: API Reference', { numbered: false }),
  p('All routes require `Authorization: Bearer <token>` except `POST /auth/login`. Interactive documentation is served at `/docs`.'),
  tbl('tbl:api', 'REST API endpoints', ['Method', 'Path', 'Access', 'Description'], [9, 31, 12, 48], [
    ['POST', '`/auth/login`', 'Public', 'Email and password; returns a JWT access token'],
    ['GET', '`/auth/me`', 'Any user', 'Current user'],
    ['PATCH', '`/auth/profile`', 'Any user', 'Update own name and email'],
    ['PATCH', '`/auth/password`', 'Any user', 'Change own password'],
    ['POST', '`/auth/users`', 'Admin', 'Create an operator account'],
    ['GET', '`/auth/users`', 'Admin', 'List accounts'],
    ['PATCH', '`/auth/users/{user_id}/status`', 'Admin', 'Activate or deactivate an account'],
    ['GET', '`/cameras`', 'Any user', 'List active sources'],
    ['POST', '`/start-camera`', 'Any user', 'Start a live or file source (400 if it cannot be opened)'],
    ['POST', '`/upload-video`', 'Any user', 'Upload a video file and start it as a source'],
    ['POST', '`/stop-camera/{source_id}`', 'Any user', 'Stop one source'],
    ['GET', '`/frame/{source_id}`', 'Any user', 'Latest processed preview frame (JPEG)'],
    ['GET', '`/cameras/{source_id}/config`', 'Any user', 'Zones, schedule and armed state'],
    ['PUT', '`/cameras/{source_id}/zones`', 'Any user', 'Replace all zones of a camera'],
    ['PUT', '`/cameras/{source_id}/schedule`', 'Any user', 'Set the arming schedule'],
    ['GET', '`/events`', 'Any user', 'List events with source, type, time range, limit and offset filters'],
    ['GET', '`/events/search?q=`', 'Any user', 'Natural-language search'],
    ['GET', '`/events/stats`', 'Any user', 'Aggregated event statistics'],
    ['GET', '`/events/{id}/snapshot`', 'Any user', 'Snapshot JPEG'],
    ['GET', '`/events/{id}/clip`', 'Any user', 'Video clip (WebM)'],
    ['DELETE', '`/events/{id}`', 'Admin', 'Delete an event, its snapshot and its clip'],
    ['GET', '`/system/status`', 'Any user', 'Health: API, database and pipeline state'],
  ]),
  h1('Appendix B: Glossary', { numbered: false }),
  tbl('tbl:glossary', 'Glossary', ['Term', 'Meaning'], [24, 76], [
    ['DCP', 'Dark Channel Prior: haze-free outdoor patches usually contain pixels that are dark in at least one colour channel, which gives an estimate of haze thickness'],
    ['Transmission (t)', 'The fraction of scene light that reaches the camera at a pixel; low means thick haze'],
    ['Atmospheric light (A)', 'The colour of the haze itself, estimated from the brightest dark-channel pixels'],
    ['ROI', 'Region of interest: the box around detected motion that is processed'],
    ['MOG2', 'A Gaussian-mixture background subtraction algorithm in OpenCV'],
    ['Zone', 'An include or exclude polygon limiting where motion counts'],
    ['Armed / disarmed', 'Whether a camera is currently inside its schedule window and detecting'],
    ['Pre-roll / post-roll', 'Video recorded before and after the moment an event was logged'],
    ['JWT', 'JSON Web Token: a signed token proving who is signed in'],
  ]),
];
