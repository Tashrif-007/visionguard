// Mermaid sources for the generated design diagrams (rendered to PNG by render_diagrams.js).
module.exports = {
architecture: `flowchart TB
  subgraph FE["Frontend: React 19 + TypeScript"]
    FE1["pages, components"] --> FE2["React Query hooks"] --> FE3["Axios api layer"]
  end
  subgraph BE["Backend: FastAPI"]
    R["routers"] --> C["controllers"] --> S["services"] --> RP["repositories"]
  end
  FE3 -- "REST + JWT" --> R
  S --> CP["CapturePool<br/>CaptureManager per camera"]
  CP --> PL["dehaze_roi + Tiny CNN"]
  RP --> DB[("PostgreSQL")]
  CP --> FS[("snapshots, clips, uploads")]
  S --> CL["Claude API"]`,

classes_domain: `classDiagram
  class User {
    +int id
    +str name
    +str email
    +str password_hash
    +str role
    +bool is_active
    +datetime created_at
  }
  class VideoSource {
    +int id
    +str name
    +str source_type
    +str source_uri
    +bool is_active
    +int created_by
    +datetime created_at
  }
  class Event {
    +int id
    +int source_id
    +str event_type
    +datetime timestamp
    +str image_path
    +int roi_x
    +int roi_y
    +int roi_width
    +int roi_height
    +float roi_area_ratio
    +str clip_path
    +int frame_number
  }
  class CameraZone {
    +int id
    +int source_id
    +str name
    +str mode
    +json points
  }
  class CameraSchedule {
    +int id
    +int source_id
    +bool enabled
    +json weekdays
    +time start_time
    +time end_time
  }
  User "1" --> "0..*" VideoSource : creates
  VideoSource "1" --> "0..*" Event : generates
  VideoSource "1" --> "0..*" CameraZone : restricts
  VideoSource "1" --> "0..1" CameraSchedule : arms`,

classes_services: `classDiagram
  direction LR
  class CapturePool {
    +start()
    +stop()
    +update_config()
    +get_latest_jpeg()
  }
  class CaptureManager {
    -config
    -recorder
    -motion_streak
    -_process_frame()
    -_is_armed()
    -_get_zone_mask()
  }
  class LatestFrameReader
  class MotionDetector {
    +apply(frame)
  }
  class ClipRecorder {
    +start_clip()
    +add_frame()
    +flush()
  }
  class CameraConfig {
    +zones
    +schedule
  }
  class Zone {
    +name
    +mode
    +points
  }
  class Schedule {
    +enabled
    +weekdays
    +start_time
    +end_time
  }
  CapturePool "1" o-- "*" CaptureManager
  CaptureManager --> LatestFrameReader
  CaptureManager --> MotionDetector
  CaptureManager --> ClipRecorder
  CaptureManager --> CameraConfig
  CameraConfig o-- Zone
  CameraConfig o-- Schedule`,

classes_layers: `classDiagram
  direction LR
  class AuthService {
    +authenticate()
    +create_access_token()
    +create_user()
    +set_user_active()
    +seed_admin()
  }
  class EventService {
    +log_motion_event()
    +list_events()
    +get_event_clip_path()
    +get_event_stats()
  }
  class ZoneService {
    +get_config()
    +save_zones()
    +save_schedule()
    +inherit_config()
  }
  class CameraService {
    +start_camera()
    +stop_camera()
    +register_upload()
  }
  class UserRepository
  class VideoSourceRepository
  class EventRepository
  class ZoneRepository
  AuthService ..> UserRepository
  CameraService ..> VideoSourceRepository
  CameraService ..> ZoneService
  ZoneService ..> ZoneRepository
  EventService ..> EventRepository`,

erd: `erDiagram
  USERS ||--o{ VIDEO_SOURCES : creates
  VIDEO_SOURCES ||--o{ EVENTS : generates
  VIDEO_SOURCES ||--o{ CAMERA_ZONES : has
  VIDEO_SOURCES ||--o| CAMERA_SCHEDULES : has
  USERS {
    int id PK
    string name
    string email UK
    string password_hash
    string role
    bool is_active
    datetime created_at
  }
  VIDEO_SOURCES {
    int id PK
    string name
    string source_type
    text source_uri
    bool is_active
    int created_by FK
    datetime created_at
  }
  EVENTS {
    int id PK
    int source_id FK
    string event_type
    datetime timestamp
    text image_path
    int roi_x
    int roi_y
    int roi_width
    int roi_height
    float roi_area_ratio
    text clip_path
    int frame_number
    datetime created_at
  }
  CAMERA_ZONES {
    int id PK
    int source_id FK
    string name
    string mode
    json points
    datetime created_at
  }
  CAMERA_SCHEDULES {
    int id PK
    int source_id FK
    bool enabled
    json weekdays
    time start_time
    time end_time
  }`,

state_capture: `stateDiagram-v2
  [*] --> Opening : start(source_id, uri)
  Opening --> Failed : cannot open source
  Failed --> [*] : source deactivated, HTTP 400
  Opening --> WarmingUp : capture opened
  WarmingUp --> Armed : warm-up frames elapsed
  Armed --> Disarmed : outside schedule window
  Disarmed --> Armed : inside schedule window
  Armed --> Detecting : motion in an active zone
  Detecting --> Armed : no motion this frame (streak reset)
  Detecting --> Logging : streak >= MOTION_MIN_FRAMES and cooldown elapsed
  Logging --> Detecting : event + clip queued
  Armed --> Stopped : stop() / operator removes camera
  Detecting --> Stopped : stop()
  Disarmed --> Stopped : stop()
  Armed --> Ended : file source reaches EOF
  Ended --> [*] : source deactivated
  Stopped --> [*]`,

state_event: `stateDiagram-v2
  [*] --> Triggered : streak and cooldown satisfied
  Triggered --> SnapshotWriting : frame copy queued
  SnapshotWriting --> Persisted : JPEG saved, row inserted (clip_path reserved)
  Triggered --> Recording : ClipRecorder.start_clip()
  Recording --> Recording : append post-roll frames
  Recording --> Encoding : post-roll complete (or source ended)
  Encoding --> ClipReady : VP8 file renamed from .part
  Encoding --> ClipFailed : writer cannot open
  Persisted --> Available : snapshot served immediately
  ClipReady --> Available : clip served (HTTP 200)
  ClipFailed --> Available : clip returns 404, snapshot only
  Available --> Deleted : admin deletes event
  Deleted --> [*] : row, snapshot and clip removed`,

state_armed: `stateDiagram-v2
  [*] --> Always : no schedule, or schedule disabled
  Always --> Evaluated : operator saves schedule
  state Evaluated {
    [*] --> InWindow
    InWindow --> OutOfWindow : clock leaves start..end on a selected weekday
    OutOfWindow --> InWindow : clock enters window
  }
  Evaluated --> Always : operator disables schedule`,

seq_login: `sequenceDiagram
  actor U as Operator
  participant FE as Frontend
  participant R as Router and controller
  participant S as AuthService
  participant DB as UserRepository
  U->>FE: email and password
  FE->>R: POST /auth/login
  R->>S: authenticate()
  S->>DB: get_by_email()
  DB-->>S: User or None
  S->>S: bcrypt verify
  alt invalid or inactive
    S-->>R: InvalidCredentialsError
    R-->>FE: 401
    FE-->>U: error message
  else valid
    S->>S: create_access_token()
    S-->>R: JWT
    R-->>FE: 200 access_token
    FE-->>U: store token, open dashboard
  end`,

seq_frame: `sequenceDiagram
  participant RD as Frame source
  participant CM as CaptureManager
  participant MD as MotionDetector
  participant PL as dehaze_roi
  participant CR as ClipRecorder
  participant EX as Event executor
  RD->>CM: frame
  CM->>MD: apply(frame)
  MD-->>CM: motion mask
  alt armed and past warm-up
    CM->>CM: AND zone mask, extract ROI
    opt ROI found
      CM->>PL: dehaze ROI
      PL-->>CM: enhanced ROI merged
      CM->>CM: motion_streak + 1
      opt streak and cooldown satisfied
        CM->>CR: start_clip (pre-roll)
        CM->>EX: log event (frame copy)
        EX->>EX: save JPEG, INSERT row
      end
    end
  else disarmed
    CM->>CM: skip detection
  end
  CM->>CR: add_frame
  CR-->>EX: clip complete
  EX->>EX: encode WebM, rename`,

seq_search: `sequenceDiagram
  actor U as Operator
  participant FE as Events page
  participant API as Router and controller
  participant N as nlp_search
  participant LLM as Claude API
  participant E as EventService
  U->>FE: any motion last night?
  FE->>API: GET /events/search?q=
  API->>N: parse_query(q)
  N->>LLM: structured output request
  alt error, no key or invalid output
    N-->>API: empty ParsedFilters
  else success
    LLM-->>N: from_ts, to_ts, event_type
    N-->>API: ParsedFilters
  end
  API->>E: list_events(filters)
  E-->>API: events and total
  API-->>FE: SearchResponse
  FE-->>U: filter chips and event cards`,

seq_zones: `sequenceDiagram
  actor U as Operator
  participant UI as ZoneEditor
  participant API as Router and controller
  participant S as ZoneService
  participant R as ZoneRepository
  participant P as CapturePool
  U->>UI: draw polygons, Save
  UI->>API: PUT /cameras/id/zones
  API->>S: save_zones()
  S->>S: validate points and count
  S->>R: replace_zones()
  S-->>API: runtime CameraConfig
  API->>P: update_config()
  Note over P: manager swaps config,<br/>mask rebuilt next frame
  API-->>UI: CameraConfigRead
  UI-->>U: toast, applied live`,

deployment: `flowchart TB
  B["Operator browser<br/>React SPA :5173"]
  subgraph SRV["Application server (CPU only)"]
    PY["uvicorn backend.main:app :8000<br/>FastAPI, capture threads, PyTorch CPU"]
    FSY[("snapshots/ clips/ uploads/<br/>backend/weights/")]
  end
  PG[("PostgreSQL 14+<br/>database visionguard")]
  CAM["Webcam or IP camera<br/>RTSP, HTTP"]
  CLA["Anthropic Claude API"]
  B -- "HTTPS REST + JWT" --> PY
  PY -- "SQLAlchemy / psycopg2 :5432" --> PG
  PY --- FSY
  CAM -- "frames" --> PY
  PY -- "HTTPS, optional" --> CLA`,

ui_states: `stateDiagram-v2
  [*] --> Landing
  Landing --> Login : Sign in
  Login --> Dashboard : valid credentials
  Login --> Login : invalid credentials (error toast)
  Dashboard --> AddCameraDialog : Add camera
  AddCameraDialog --> Dashboard : source started / cancel
  Dashboard --> ConfigureDialog : Configure on a tile
  ConfigureDialog --> Dashboard : close
  Dashboard --> Events : sidebar
  Events --> Analytics : sidebar
  Analytics --> Events : sidebar
  Events --> EvidenceInspector : select event
  EvidenceInspector --> Events : select another
  Dashboard --> Profile : user menu
  Dashboard --> Admin : sidebar (admin only)
  Dashboard --> Login : sign out or 401
  Events --> Login : sign out or 401`,

frontend_layers: `flowchart TB
  A["pages<br/>Landing, Login, Dashboard, Events, Analytics, Profile, Admin"]
  B["components<br/>CameraGrid, CameraTile, ZoneEditor, ScheduleEditor,<br/>Timeline, EvidenceInspector, EventClipPlayer, ui primitives"]
  C["hooks (React Query)<br/>useAuth, useCamera, useCameraConfig,<br/>useEvents, useEventStats, useEventClip"]
  D["api (Axios)<br/>authApi, cameraApi, zonesApi, eventsApi"]
  E[("Backend REST API")]
  A --> B --> C --> D --> E`,

act_zones: `flowchart TB
  A([Operator opens Configure on a camera tile]) --> B[Load camera config and live frame]
  B --> C{Which tab?}
  C -- Zones --> D[Click image to outline a polygon]
  D --> E{3 or more points?}
  E -- no --> D
  E -- yes --> F[Choose include or exclude, finish zone]
  F --> G{More zones?}
  G -- yes --> D
  G -- no --> H[Save zones]
  C -- Schedule --> I[Tick weekdays, set start and end time]
  I --> J[Save schedule]
  H --> K{Valid?}
  J --> K
  K -- no --> L[Show error toast]
  L --> C
  K -- yes --> M[Server stores config, CapturePool.update_config]
  M --> N([Running feed uses new zones and schedule on the next frame])`,

act_review: `flowchart TB
  A([Operator opens Events page]) --> B[Timeline loads newest events first]
  B --> C{Search by text?}
  C -- yes --> D[Claude parses query into filters, SQL runs]
  C -- no --> E[Browse list]
  D --> F[Select an event]
  E --> F
  F --> G{Event has a clip?}
  G -- yes --> H[Fetch clip as authenticated blob]
  H --> I{Clip file ready?}
  I -- no --> J[Show recording message, retry every 1.5 s]
  J --> I
  I -- yes --> K[Play video, ROI box visible]
  G -- no --> L[Show snapshot with ROI overlay]
  K --> M{Switch to snapshot?}
  M -- yes --> L
  M -- no --> N([Done])
  L --> N`
};
