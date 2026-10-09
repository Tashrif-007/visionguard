<p align="center">
  <img src="docs/logo.png" alt="VisionGuard AI logo" width="120" />
</p>

<h1 align="center">VisionGuard AI</h1>

<p align="center">
  <b>Live demo:</b> <a href="https://visionguarding.netlify.app">visionguarding.netlify.app</a>
</p>

VisionGuard AI is a lightweight, CPU-friendly CCTV surveillance platform that restores visibility in hazy or smoggy footage in real time. It pairs a classical Dark Channel Prior (DCP) with a Tiny CNN that refines the transmission map, and it only dehazes the region where motion was detected, so it runs without a GPU.

## Features

- **Hybrid dehazing:** DCP and atmospheric scattering model, with a Tiny CNN refining the transmission map.
- **Motion-gated ROI processing:** frames with no motion are skipped, and only the motion region is dehazed.
- **Multi-camera:** webcam, IP/RTSP stream, uploaded video, or a phone/laptop camera streamed from the browser. Cameras start and stop independently.
- **Detection zones and schedules:** include/exclude polygons and weekly arming schedules per camera.
- **Event logging:** timestamped events with snapshot, video clip and ROI coordinates, plus a timeline browser.
- **Natural-language search:** ask "any motion last night?" and an LLM (via OpenRouter) turns it into filters.
- **Analytics:** events per day, per camera, weekday x hour heatmap.
- **Accounts:** JWT auth with admin-seeded accounts; every user's cameras and events are private to them.

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+, either installed locally or run through Docker
- Optional: an [OpenRouter](https://openrouter.ai) API key for natural-language search. Without one, queries return unfiltered results.

### 1. Database (PostgreSQL)

The backend builds its connection URL from the `POSTGRES_*` values in `.env`:

```
postgresql+psycopg2://POSTGRES_USER:POSTGRES_PASSWORD@POSTGRES_HOST:POSTGRES_PORT/POSTGRES_DB
```

Pick **one** of the two options below. Tables are created automatically on first startup by the migrations; you only need an empty database.

#### Option A: PostgreSQL installed locally

1. Install and start PostgreSQL (Ubuntu/Debian shown; on macOS use `brew install postgresql@16 && brew services start postgresql@16`):

   ```bash
   sudo apt install postgresql
   sudo systemctl start postgresql
   ```

2. Create a user and database:

   ```bash
   sudo -u postgres psql -c "CREATE USER visionguard WITH PASSWORD 'your_password';"
   sudo -u postgres psql -c "CREATE DATABASE visionguard OWNER visionguard;"
   ```

3. Use these values in `.env`:

   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=visionguard
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=visionguard
   ```

#### Option B: PostgreSQL in Docker

1. Pull the image and start a container (host port `5434` avoids clashing with a local Postgres on `5432`):

   ```bash
   docker pull postgres:16
   docker run -d --name visionguard-db \
     -e POSTGRES_USER=visionguard \
     -e POSTGRES_PASSWORD=your_password \
     -p 5434:5432 \
     -v visionguard-pgdata:/var/lib/postgresql/data \
     postgres:16
   ```

2. Create the database inside the container:

   ```bash
   docker exec -it visionguard-db psql -U visionguard -d postgres -c "CREATE DATABASE visionguard;"
   ```

3. Use these values in `.env`:

   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5434
   POSTGRES_USER=visionguard
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=visionguard
   ```

Next time, start the container again with `docker start visionguard-db`.

### 2. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
```

Edit `.env`: set the `POSTGRES_*` values from step 1, `JWT_SECRET_KEY` (any long random string), and `ADMIN_EMAIL` / `ADMIN_PASSWORD` (seeds the first admin on startup). The Tiny CNN weights are checked in at `backend/weights/tiny_cnn.pth`.

```bash
uvicorn backend.main:app --reload
```

The API runs at `http://localhost:8000` (docs at `/docs`). Database migrations are applied automatically on startup.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:8000
npm run dev
```

Open `http://localhost:5173` and sign in with the admin credentials from `.env`.

### 4. Tests

```bash
source venv/bin/activate
pytest
```

## Architecture

```mermaid
flowchart LR
    subgraph FE["Frontend: React + TypeScript + Vite"]
        P[Pages / components] --> H[React Query hooks] --> A[Axios API layer]
    end

    subgraph BE["Backend: FastAPI"]
        R[Routers] --> C[Controllers] --> S[Services]
        S --> Repo[Repositories]
    end

    A -- "REST + JWT / WebSocket" --> R
    Repo --> DB[(PostgreSQL)]
    S --> LLM[OpenRouter LLM<br/>search query parsing]
    S --> CP[CapturePool<br/>one worker per camera]
    CP --> PL
    CP --> FS[(Snapshots, clips, uploads)]

    subgraph PL["Dehazing pipeline"]
        direction LR
        M[Motion detection] --> ROI[ROI extraction] --> D[Dark channel + atmospheric light]
        D --> T[Coarse transmission] --> CNN[Tiny CNN refinement]
        CNN --> Rad[Radiance recovery + gamma] --> Merge[Merge ROI into frame]
    end
```

**Core idea:** physics prior (DCP) plus lightweight learning (Tiny CNN). The CNN only refines the transmission map; all image reconstruction uses the atmospheric scattering model.

- **Layering:** routers define routes only, controllers orchestrate, services hold business logic, repositories are the only code that touches the database.
- **Capture:** each camera runs in its own worker inside `CapturePool`. Frames without motion are skipped, and detected motion becomes an event with a snapshot and clip.
- **Multi-tenancy:** every camera, and everything under it, belongs to exactly one user.

## Screenshots

| Landing | Login |
|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Login](docs/screenshots/login.png) |

| Live dashboard | Cameras |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Cameras](docs/screenshots/cameras.png) |

| Events timeline | Analytics |
|---|---|
| ![Events](docs/screenshots/events.png) | ![Analytics](docs/screenshots/analytics.png) |

| Detection zones | Admin |
|---|---|
| ![Zones](docs/screenshots/zones.png) | ![Admin](docs/screenshots/admin.png) |
