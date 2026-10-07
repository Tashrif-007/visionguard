// The end-to-end sequence diagram of final_diagrams.js, split into three readable parts.
const head = (extra = '') => `sequenceDiagram
  participant OP as Operator (web app)
  participant API as Backend API
  participant CAP as Capture thread
  participant DB as Database and files${extra}
`;

module.exports = {
final_seq_part1: head() + `
  rect rgb(238, 244, 252)
  Note over OP,DB: 1 Sign in
  OP->>API: POST /auth/login (email, password)
  API->>DB: read user, check bcrypt hash
  API-->>OP: JWT, sent as Bearer on every request
  end

  rect rgb(240, 248, 238)
  Note over OP,DB: 2 Register a camera and start it
  OP->>API: POST /cameras, then POST /cameras/id/start
  API->>DB: INSERT camera with its owner
  API->>CAP: start capture with zones and schedule
  end

  rect rgb(255, 247, 232)
  Note over OP,DB: 3 Set zones and schedule
  OP->>API: PUT /cameras/id/zones and /schedule
  API->>DB: save zones and schedule
  API->>CAP: update config, used from the next frame
  end`,

final_seq_part2: head() + `
  rect rgb(250, 240, 246)
  Note over OP,DB: 4 Processing every frame
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
  end`,

final_seq_part3: head('\n  participant LLM as OpenRouter LLM') + `
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
};
