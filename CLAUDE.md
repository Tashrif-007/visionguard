# VisionGuard AI — CLAUDE.md

## Project Overview

VisionGuard AI is a lightweight, CPU-friendly CCTV surveillance platform that enhances visibility in hazy or smoggy environments in real time. It uses a **hybrid approach**: classical computer vision (Dark Channel Prior) combined with a Tiny CNN that refines the transmission map — not an end-to-end deep learning solution.

The key optimization is **ROI-based dehazing**: dehazing only runs on the suspicious region detected via motion, not on every pixel of every frame. This keeps CPU usage low and makes the system edge-deployable without a GPU.

**Target users:** security guards, building operators, campus/warehouse/parking-lot surveillance teams.

---

## Core Architecture Principle

```
Physics Prior (DCP) + Lightweight Learning (Tiny CNN)
```

NOT end-to-end deep learning. The CNN's only job is to refine the DCP transmission map. All image reconstruction uses the physical atmospheric scattering model.

---

## Dehazing Pipeline

```
Video Frame
  → Motion Detection (skip if no motion)
  → ROI Extraction
  → Dark Channel Prior
  → Atmospheric Light Estimation (Top-K brightest pixels, not single pixel)
  → Initial Transmission Map
  → Tiny CNN Refinement
  → Radiance Recovery (Atmospheric Scattering Model)
  → Gamma Correction
  → Merge Enhanced ROI back into Frame
```

---

## Tiny CNN Architecture

Input channels: grayscale ROI + dark channel + coarse transmission map

```
Conv(3×3, 16) → ReLU
Conv(3×3, 32) → ReLU
Conv(3×3, 16) → ReLU
Conv(3×3,  1) → Sigmoid
→ Refined Transmission Map
```

Future: predict **residual** `Δt` instead of absolute `t`, so `t_final = t_DCP + Δt`.

---

## Features (MVP Scope)

| Feature | Status |
|---|---|
| User authentication (JWT, admin-seeded accounts) | MVP |
| Live webcam / IP camera / uploaded video feed | MVP |
| Motion detection (skip dehazing when no motion) | MVP |
| ROI extraction from motion mask | MVP |
| Hybrid DCP + Tiny CNN dehazing pipeline | MVP |
| Event logging (timestamp, image, type, ROI coords) | MVP |
| Timeline / event browser | MVP |
| Natural language event search (e.g. "any motion last night?") | MVP |
| Multi-camera support (concurrent feeds, independent start/stop) | MVP |
| Browser camera (device webcam/phone camera streamed from the browser over WebSocket) | Implemented |
| Object detection / intrusion detection | Future only |
| ONNX Runtime inference | Future only |
| FFmpeg integration | Future only |

Do **not** implement future items unless explicitly asked.

---

## Performance Goals

- 30 FPS on CPU
- No GPU required for inference
- Low memory footprint
- Edge deployable

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Web framework | FastAPI |
| CV | OpenCV |
| Numerics | NumPy |
| Deep learning | PyTorch |
| Inference (future) | ONNX Runtime |
| Database | PostgreSQL via SQLAlchemy + psycopg2 |
| Auth | PyJWT + passlib[bcrypt] |
| Config | python-dotenv (.env) |
| NLP query parsing | LLM via OpenRouter (httpx, OpenAI-compatible chat completions) |
| Linting | ruff, black, isort, mypy |

### Frontend
| Layer | Technology |
|---|---|
| Language | TypeScript |
| Framework | React |
| Bundler | Vite |
| Styling | TailwindCSS + Shadcn UI |
| Data fetching | React Query (TanStack Query) |
| HTTP client | Axios |

---

## Project Structure

```
visionguard/
├── backend/
│   ├── api/
│   │   ├── routers/          # FastAPI routers — route definitions only, no logic
│   │   │   ├── auth.py
│   │   │   ├── camera.py
│   │   │   ├── events.py
│   │   │   ├── search.py
│   │   │   └── system.py
│   │   └── dependencies.py   # FastAPI dependency injection helpers
│   ├── controllers/          # Request/response orchestration, calls services
│   │   ├── auth_controller.py
│   │   ├── camera_controller.py
│   │   └── event_controller.py
│   ├── services/             # Business logic, pure functions, no HTTP concerns
│   │   ├── dehazing/
│   │   │   ├── dark_channel.py
│   │   │   ├── atmosphere.py
│   │   │   ├── transmission.py
│   │   │   ├── radiance.py
│   │   │   └── gamma.py
│   │   ├── motion/
│   │   │   ├── motion_detector.py
│   │   │   └── roi.py
│   │   ├── pipeline.py       # Orchestrates the full dehazing pipeline
│   │   ├── auth_service.py   # Password verification, JWT issue/decode
│   │   ├── event_service.py
│   │   └── nlp_search.py     # Parses natural language queries into structured filters via OpenRouter
│   ├── models/               # PyTorch model definitions
│   │   └── tiny_cnn.py
│   ├── schemas/              # Pydantic request/response schemas
│   │   ├── auth.py           # LoginRequest, TokenResponse, UserRead, UserCreate
│   │   ├── camera.py
│   │   ├── event.py
│   │   └── search.py         # SearchQuery, ParsedFilters, SearchResponse
│   ├── db/
│   │   ├── database.py       # SQLAlchemy engine, session factory, run_migrations()
│   │   ├── models.py         # ORM table definitions
│   │   ├── migrations/       # Alembic env + versions/ (schema changes live here)
│   │   └── repositories/     # DB access — no raw queries outside here
│   │       ├── camera_repository.py
│   │       ├── event_repository.py
│   │       ├── user_repository.py
│   │       └── zone_repository.py
│   ├── config.py             # Settings loaded from .env via pydantic-settings
│   ├── main.py               # FastAPI app creation, router registration
│   └── weights/              # Trained model weights (.pth / .onnx)
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios instances and typed API call functions
│   │   │   ├── client.ts
│   │   │   ├── authApi.ts
│   │   │   ├── cameraApi.ts
│   │   │   └── eventsApi.ts
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # Shadcn-generated primitives
│   │   │   ├── VideoFeed.tsx
│   │   │   ├── EventCard.tsx
│   │   │   └── Timeline.tsx
│   │   ├── hooks/            # React Query hooks wrapping api/ calls
│   │   │   ├── useAuth.ts
│   │   │   ├── useCamera.ts
│   │   │   ├── useEvents.ts
│   │   │   └── useEventSearch.ts
│   │   ├── pages/            # Route-level page components
│   │   │   ├── LoginPage.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── EventsPage.tsx
│   │   ├── types/            # Shared TypeScript types and interfaces
│   │   │   └── index.ts
│   │   ├── utils/            # Pure utility functions
│   │   └── App.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── training/
│   ├── dataset.py
│   └── train.py
├── tests/
│   ├── test_dark_channel.py
│   ├── test_transmission.py
│   ├── test_cnn_inference.py
│   ├── test_motion_detector.py
│   └── test_roi.py
├── .env
├── .env.example
└── README.md
```

---

## Backend Layer Responsibilities

### `api/routers/`
- Define routes with `APIRouter`.
- No business logic — delegate immediately to a controller.
- Only handle path/query params and return controller output.

### `controllers/`
- Orchestrate: validate input → call service(s) → format response.
- No direct DB access. No raw CV logic.
- Return Pydantic response schemas.

### `services/`
- All business logic lives here.
- Functions must be pure where possible; avoid hidden state.
- Dehazing, motion detection, event management are separate service modules.
- `pipeline.py` is the only place that chains dehazing steps together.

### `schemas/`
- Pydantic models for every API request and response.
- No ORM models exposed directly to the API layer.

### `db/models.py`
- SQLAlchemy ORM table definitions only.

### `db/migrations/` (Alembic)
- Every schema change is a new migration in `db/migrations/versions/` (`alembic revision --autogenerate -m "..."`, then review it). Data moves are written by hand in the same migration.
- The app runs `alembic upgrade head` on startup (`run_migrations()` in `db/database.py`); `alembic.ini` is at the repo root and reads the DB URL from `config.py`.
- Never use `Base.metadata.create_all` or ad-hoc `ALTER TABLE` helpers.

### `db/repositories/`
- All DB read/write goes through repository functions.
- Controllers call repositories via services — never directly.

### `models/`
- PyTorch `nn.Module` definitions.
- No training code here — training lives in `/training/`.

### `config.py`
- Use `pydantic-settings` `BaseSettings` to load from `.env`.
- Never hardcode paths, thresholds, or model paths anywhere else.

---

## Frontend Layer Responsibilities

### `api/`
- Typed Axios wrapper functions, one file per backend resource.
- No React imports — pure async functions only.

### `hooks/`
- React Query `useQuery` / `useMutation` hooks that call `api/` functions.
- All server state lives here; no raw `fetch`/`axios` in components.

### `components/`
- Presentational and container components.
- Receive data via props or hooks — no direct API calls.

### `pages/`
- One component per route; compose hooks and components.

### `types/`
- Single source of truth for shared TypeScript interfaces.
- Mirror backend Pydantic schema shapes.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Log in, returns a JWT access token |
| GET | `/auth/me` | Current authenticated user |
| POST | `/auth/users` | Create an operator account (admin only) |
| PATCH | `/auth/password` | Change own password |
| GET | `/cameras` | List saved cameras with live `status` (running / stopped / ended / offline / error) |
| POST | `/cameras` | Register a camera `{name?, source_uri?}` (409 if the URI is taken; re-registering a deleted camera's URI restores it) |
| PATCH | `/cameras/{camera_id}` | Rename / change source (source change only while stopped) |
| DELETE | `/cameras/{camera_id}` | Soft-delete a camera (stops it; events are kept) |
| POST | `/cameras/{camera_id}/start` | Start capture for a saved camera |
| POST | `/cameras/{camera_id}/stop` | Stop capture |
| POST | `/upload-video` | Upload a video file, register it as an `upload` camera and start it |
| GET | `/events` | List logged events (with filters) |
| GET | `/events/{id}/snapshot` | Event snapshot JPEG (authenticated; replaces the old open `/snapshots` mount) |
| DELETE | `/events/{id}` | Delete an event (admin only) |
| PATCH | `/auth/profile` | Update own name/email |
| GET | `/auth/users` | List accounts (admin only) |
| PATCH | `/auth/users/{user_id}/status` | Activate/deactivate an account (admin only) |
| GET | `/events/search` | Natural language event search (`?q=...`) |
| GET | `/events/stats` | Aggregated event counts (per day, per camera, weekday×hour heatmap, motion-size buckets) |
| GET | `/events/{id}/clip` | Event video clip (WebM, authenticated; written a few seconds after the event) |
| GET | `/cameras/{camera_id}/config` | Detection zones, schedule, and armed state for a camera |
| PUT | `/cameras/{camera_id}/zones` | Replace a camera's include/exclude detection zones |
| PUT | `/cameras/{camera_id}/schedule` | Set a camera's arming schedule |
| GET | `/cameras/{camera_id}/frame` | Latest processed frame for a running camera |
| WS | `/ws/cameras/{camera_id}/stream` | Browser camera: first message = bearer token, server replies `ready`, then the browser sends JPEG frames (starts/stops the camera) |
| GET | `/system/status` | Health and pipeline status |

---

## Authentication (implemented)

JWT bearer authentication protecting every endpoint except `/auth/login`.

**Flow:**
```
POST /auth/login { email, password }
  → auth router → auth controller → auth_service.authenticate()
  → verify bcrypt hash via user_repository
  → issue signed JWT (JWT_SECRET_KEY, JWT_EXPIRE_MINUTES)
  → frontend stores token, Axios interceptor adds Authorization: Bearer
```

**Key rules:**
- Auth is enforced with a `get_current_user` dependency in `api/dependencies.py`, applied at the **router** level — never checked inside services or controllers.
- **Admin-seeded accounts, no open signup**: on startup, if no users exist, a default admin is created from `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. The admin creates operator accounts via `POST /auth/users` (guarded by an admin-only dependency).
- Roles: `admin` (account management + everything) and `operator` (everything except account management).
- **Data isolation: every user is an individual tenant.** A camera, and everything under it (events, snapshots, clips, zones, schedules, live frames, stats, search), is visible only to its owner (`cameras.created_by`) — admins included. Routers pass `current_user.id` as `owner_id` down to the repositories; someone else's camera/event is a 404, never a 403. `source_uri` is unique per owner (`uq_cameras_owner_source_uri`), so two users can register the same stream.
- `User` ORM model in `db/models.py`: `id`, `name`, `email` (unique), `password_hash`, `role`, `is_active`, `created_at`. Deactivated users cannot log in. `cameras.created_by` is a NOT NULL FK → `users.id`: the owner.
- Passwords hashed with bcrypt via passlib — plaintext never stored or logged.
- New modules follow the standard layering: `api/routers/auth.py`, `controllers/auth_controller.py`, `services/auth_service.py`, `schemas/auth.py`, `db/repositories/user_repository.py`.
- Frontend: `pages/LoginPage.tsx`, `hooks/useAuth.ts`, `api/authApi.ts`; token in localStorage; Axios request interceptor attaches the header; a 401 response interceptor clears the token and redirects to the login page.

---

## Natural Language Event Search

Users type plain English queries on the Events page. The system returns matching logged events.

**Flow:**
```
User query ("any motion last night?")
  → GET /events/search?q=...
  → search router → search controller
  → nlp_search.py: send query to an LLM via OpenRouter (JSON-schema response_format)
  → LLM returns structured ParsedFilters { from_ts, to_ts, event_type }
  → event_repository: SQL query with those filters
  → SearchResponse { query, parsed_filters, events, total }
```

**Key rules:**
- `nlp_search.py` only calls OpenRouter and returns `ParsedFilters` — no DB access.
- The OpenRouter call is the only place that uses an LLM; everything else is standard SQL.
- `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, default `qwen/qwen3.8-27b:free`) must be in `.env` and loaded via `config.py`.
- If the LLM cannot extract a time range, return all events (no filter) rather than erroring.
- The frontend search input lives on the Events page; results reuse the existing `EventCard` component.

**Schemas (`schemas/search.py`):**
```
SearchQuery       { q: str }
ParsedFilters     { from_ts: datetime | None, to_ts: datetime | None, event_type: str | None }
SearchResponse    { query: str, parsed_filters: ParsedFilters, events: list[EventRead], total: int }
```

---

## Coding Standards

### Python
- Type hints on every function signature.
- Use `dataclasses` or Pydantic models for structured data — no bare dicts.
- Dependency injection via FastAPI `Depends()`.
- Use `python-logging` everywhere — zero `print()` statements.
- Raise meaningful, typed exceptions; never silently swallow errors.
- Format with `black`, sort imports with `isort`, lint with `ruff`, type-check with `mypy`.
- Follow PEP 8.

### TypeScript / React
- Strict TypeScript (`"strict": true` in tsconfig).
- No `any` types.
- All API responses typed against interfaces in `types/`.
- All server state via React Query — no manual `useEffect` data fetching.
- Components are small and single-purpose.

---

## Configuration (.env)

```
MODEL_PATH=
VIDEO_SOURCE=
CONFIDENCE_THRESHOLD=
ROI_PADDING=

POSTGRES_HOST=
POSTGRES_PORT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=

JWT_SECRET_KEY=
JWT_EXPIRE_MINUTES=
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

All values loaded through `config.py`. No magic strings in code.

---

## What NOT To Do

### Architecture
- Do **not** put business logic in routers or route handlers.
- Do **not** access the database directly from controllers — use repositories.
- Do **not** import ORM models into API response schemas.
- Do **not** put training code or weight loading inside service modules.
- Do **not** use global mutable state for camera or pipeline state — use dependency injection.

### AI / CV
- Do **not** replace DCP with end-to-end deep learning.
- Do **not** run the dehazing pipeline on every frame — only on frames with detected motion.
- Do **not** process the full frame — only the extracted ROI.
- Do **not** use a single brightest pixel for atmospheric light estimation (causes flickering) — use Top-K average.
- Do **not** load model weights inside a request handler — load once at startup.

### Auth
- Do **not** store or log plaintext passwords — bcrypt via passlib only.
- Do **not** hand-roll token signing or crypto — use PyJWT.
- Do **not** check authentication inside services or controllers — auth is a router-level `Depends()` only.
- Do **not** add open registration — accounts are created by the admin only.

### General
- Do **not** use `print()` — use `logging`.
- Do **not** hardcode any path, threshold, or config value.
- Do **not** commit `.env` files.
- Do **not** use bare `except:` or silently ignore exceptions.
- Do **not** add global variables to share state between modules.
- Do **not** implement future features (object detection, ONNX, FFmpeg) unless explicitly asked.
- Do **not** add abstractions or helpers that no current feature requires.

---

## Development Philosophy

Priority order (in case of conflict):

1. **Simplicity** — fewest moving parts that work correctly
2. **Readability** — clear names, no clever tricks
3. **Modularity** — each module has one responsibility
4. **Explainability** — the system should remain interpretable, not a black box
5. **CPU efficiency** — every optimization must serve the 30 FPS / no-GPU goal

The neural network exists to refine DCP output, not to replace physics. Keep the hybrid identity intact.

---

## Roadmap — features proposed after the MVP (read before starting a new session)

**Already implemented (do not redo):** Alembic migrations (`backend/db/migrations/`, baseline `0001` + `0002` camera registry + `0003` camera ownership / per-user isolation); camera registry (`cameras` table — one row per source URI, soft delete via `deleted_at`; events/zones/schedules reference `camera_id`; running state is in-memory only via `CapturePool.status()`; `/cameras` page with start/stop/configure/edit/delete; the old per-start `video_sources` table is gone); multi-camera `CapturePool`; per-camera detection zones (include/exclude polygons) and weekly arming schedules (`camera_zones`, `camera_schedules`, `PUT /cameras/{id}/zones|schedule`, applied live); motion persistence (`MOTION_MIN_FRAMES`) + `events.roi_area_ratio`; event video clips (`services/clip_recorder.py`, VP8 WebM, `GET /events/{id}/clip`); events analytics (`GET /events/stats`, `/analytics` page); browser cameras (`source_type="browser"`, source `browser:<uuid>`; `PushFrameReader` in `capture_service.py` feeds the same pipeline; `routers/stream.py` WebSocket; frontend `BrowserStreamProvider` in `AppLayout` + `BrowserCameraCard` on `/cameras`; the tab must stay open and visible, and `POST /cameras/{id}/start` rejects browser cameras). Events stay labelled `motion` — never "intruder" (frame differencing cannot classify; classification is future work).

**Proposed next modules (not implemented; user has only approved discussing them — confirm scope before building).** Each adds a frontend page:
1. **Haze analytics (`/analytics/haze`)** — per-camera visibility score over time from the mean transmission, raw vs dehazed side-by-side on events (store the raw snapshot too), optional "dehaze only when haze is detected" to save CPU.
2. **Alerts (`/alerts`)** — rules (camera, schedule, min `roi_area_ratio`) delivering by email / webhook / Telegram, plus a delivery log (`alert_rules`, `alert_deliveries`), fired off-thread from event logging.
3. **Event review workflow** — status (new / reviewed / flagged), notes, bulk actions on the timeline, CSV/PDF export (`events.status`, `events.notes`).
4. **Camera health / system page (`/system`)** — per-camera FPS, latency, offline detection, CPU/memory; replaces the static `pipeline: "idle"` in `/system/status`.
5. **Audit log (admin)** — who signed in, started/stopped cameras, deleted events (`audit_logs`, written from controllers).

**Known open items:** live OpenRouter query parsing is untested with a real key (only mocked tests + an invalid-key 401 fallback check); outdoor dusk dehaze quality (CNN trained on indoor REVIDE + synthetic); no retention policy for snapshots/clips/uploads; `users.created_at` and other `server_default now()` columns are server-local naive time while `events.timestamp` is naive UTC; all of the above work is committed and pushed to `dev` on github.com/Tashrif-007/visionguard (merged from `feature/*` branches with `--no-ff`), but not yet merged into `main`.

## In-progress task: final report (SE-801 final defense)

Goal: take the user's **existing** `docs/SPL3-Technical-Report-1448.docx` and **only append** new chapters — never change existing content, fonts or sizes (the file is a PDF-to-Word conversion: Times New Roman, Body Text 14 pt, Heading 1 16 pt bold, Heading 2 14 pt bold, tables 11 pt, A4 11920×16840 twips with 0 page margins and paragraph indents of 1020/1045, headings numbered through `numId=2`, figure captions "Fig N: …", table captions as Heading 2 "Table N: …"). Deliver **DOCX only** (the user rejected the earlier PDF/LaTeX rebuild that restyled everything; those outputs were deleted).

New chapters to append after the existing chapter 6 (Timeline): 7 Component-Level Design, 8 Interface Design, 9 Implementation, 10 Testing, 11 User Manual, 12 Repository/Installer/Compliance. Content is already written in `docs/final-report/src/docx_content.js` (numbering continues from Fig 19 / Table 5 / chapter 7; `node src/export_blocks.js` writes `build/blocks.json`). Assets exist in `docs/final-report/assets/{diagrams,shots,trim}`; test results are in `src/acceptance_results.json` (37/37 pass), `src/unit_results.json` (40/40), `src/perf.json`.

**Still to do:** write `docs/final-report/src/append_docx.py` (lxml) that unzips the original, inserts the new body elements before the final `w:sectPr`, cloning the existing XML patterns (BodyText/ListParagraph/Heading1/TableParagraph paragraphs, bordered fixed tables with `tblInd`≈1000, centered captions, inline images with new `word/media` files + `document.xml.rels` entries, a new decimal `abstractNum` for numbered lists, bookmarks `h.vg_*` and extra TOC1/TOC3 entries with `PAGEREF` fields, `w:updateFields` in `settings.xml`); output `docs/SPL3-Final-Report-1448.docx`; validate with the docx skill's `validate.py` (needs `defusedxml`); check the look with a `docx-preview` render in headless Chrome (no LibreOffice is installed). Target: roughly 50–60 pages in total (existing ≈ 30).

Rebuild helpers live in `docs/final-report/` (`render_diagrams.js`, `shots.js`, `bench.py`, `trim_images.py`, `tests/acceptance_api.py`). The old PDF/DOCX/LaTeX generator (`render_docx.js`, `render_pdf.js`, `render_tex.js`, `src/content/*`) is superseded by the append approach and can be deleted.
