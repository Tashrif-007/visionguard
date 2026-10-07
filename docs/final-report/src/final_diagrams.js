// Mermaid sources for the state-transition and sequence diagrams added to the report (event flow of the current code).
module.exports = {
final_seq_event: `sequenceDiagram
  participant CM as Capture Manager
  participant MD as MotionDetector
  participant PL as dehaze_roi
  participant CR as ClipRecorder
  participant EX as Executor
  participant ES as EventService
  participant DB as Database and files
  loop every frame
    CM->>MD: apply(frame)
    MD-->>CM: motion mask
    CM->>CM: armed check, zone mask, extract ROI
    alt ROI found
      CM->>PL: dehaze ROI with Tiny CNN
      PL-->>CM: enhanced ROI
      CM->>CM: motion streak + 1
      opt streak >= 15 and cooldown over
        CM->>CR: start_clip()
        CR-->>CM: reserved clip path
        CM-)EX: submit(log_event)
        EX->>ES: log_motion_event()
        ES->>DB: save snapshot, INSERT event
      end
    else no ROI
      CM->>CM: streak = 0
    end
    CM->>CR: add_frame(frame)
    CR-)EX: finished clip
    EX->>DB: write WebM clip
  end`,

final_seq_full: `sequenceDiagram
  participant OP as Operator (web app)
  participant API as Backend API
  participant CAP as Capture thread
  participant DB as Database and files
  participant LLM as OpenRouter LLM

  rect rgb(238, 244, 252)
  Note over OP,LLM: 1 Sign in
  OP->>API: POST /auth/login (email, password)
  API->>DB: read user, check bcrypt hash
  API-->>OP: JWT, sent as Bearer on every request
  end

  rect rgb(240, 248, 238)
  Note over OP,LLM: 2 Register a camera and start it
  OP->>API: POST /cameras, then POST /cameras/id/start
  API->>DB: INSERT camera with its owner
  API->>CAP: start capture with zones and schedule
  end

  rect rgb(255, 247, 232)
  Note over OP,LLM: 3 Set zones and schedule
  OP->>API: PUT /cameras/id/zones and /schedule
  API->>DB: save zones and schedule
  API->>CAP: update config, used from the next frame
  end

  rect rgb(250, 240, 246)
  Note over OP,LLM: 4 Processing every frame
  loop every frame
    CAP->>CAP: motion mask, schedule and zone check, ROI
    alt ROI found
      CAP->>CAP: dehaze ROI (DCP and Tiny CNN), streak + 1
      opt streak long enough and cooldown over
        CAP->>DB: snapshot, event row, WebM clip
      end
    else no ROI
      CAP->>CAP: streak = 0
    end
  end
  OP->>API: GET /cameras/id/frame (live view)
  API-->>OP: latest processed frame
  end

  rect rgb(238, 244, 252)
  Note over OP,LLM: 5 Review events
  OP->>API: GET /events, /events/stats, snapshot, clip
  API->>DB: query events of own cameras only
  API-->>OP: events, statistics, JPEG, WebM
  end

  rect rgb(240, 248, 238)
  Note over OP,LLM: 6 Natural-language search
  OP->>API: GET /events/search?q=any motion last night
  API->>LLM: parse question into filters
  LLM-->>API: from, to, event type
  API->>DB: SQL query with the filters
  API-->>OP: matching events
  end

  rect rgb(255, 247, 232)
  Note over OP,LLM: 7 Delete an event and stop the camera
  opt administrator only
    OP->>API: DELETE /events/id
    API->>DB: remove row, snapshot, clip
  end
  OP->>API: POST /cameras/id/stop
  API->>CAP: stop capture
  end`,

final_seq_review: `sequenceDiagram
  participant OP as Operator
  participant UI as Events page
  participant API as events router
  participant EC as event controller
  participant ES as EventService
  participant DB as Database and files
  OP->>UI: open Events page
  UI->>API: GET /events (JWT)
  API->>EC: get_events(owner_id)
  EC->>ES: list_events()
  ES->>DB: SELECT events of own cameras
  DB-->>UI: event list
  OP->>UI: select an event
  UI->>API: GET /events/id/snapshot and /clip
  API->>ES: get_event_snapshot, get_event_clip_path
  alt clip file exists
    ES-->>UI: JPEG and WebM
  else clip still being written
    ES-->>UI: 404, UI retries
  end
  opt administrator only
    OP->>UI: delete event
    UI->>API: DELETE /events/id
    API->>ES: delete_event()
    ES->>DB: remove row, snapshot, clip
    API-->>UI: 204
  end`,

};
