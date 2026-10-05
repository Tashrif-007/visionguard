# VisionGuard AI

A lightweight, CPU-friendly CCTV surveillance platform that enhances visibility in hazy or smoggy footage in real time. It combines classical computer vision (Dark Channel Prior) with a Tiny CNN that refines the transmission map, and only runs the dehazing pipeline on the motion-detected region of each frame, not the full frame, so it stays fast without a GPU.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, pipeline, and coding-standards reference.

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- An Anthropic API key (optional — enables natural-language event search; the app runs fine without one, queries just return unfiltered results)

## Backend setup

```bash
# from the repo root
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create the database:

```bash
createdb visionguard
```

Configure environment variables:

```bash
cp .env.example .env
```

Fill in at least `POSTGRES_*`, `JWT_SECRET_KEY` (any long random string), and `ADMIN_EMAIL` and `ADMIN_PASSWORD` (used to seed the first admin account on startup; `ADMIN_NAME` is optional). `ANTHROPIC_API_KEY` is optional. `MODEL_PATH` already points at the checked-in Tiny CNN weights (`backend/weights/tiny_cnn.pth`), no download needed.

Run the API from the repo root (imports are rooted at `backend.*`):

```bash
uvicorn backend.main:app --reload
```

The API is now at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`. On first startup it seeds an admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` — log in with those (login is by email), then create operator accounts from the Admin page in the UI (or `POST /auth/users`).

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:8000, matching the backend above
npm run dev
```

The dashboard is now at `http://localhost:5173`.

## Running tests

```bash
source venv/bin/activate
pytest
```

## Training the Tiny CNN

Training code lives in `training/` and is separate from the inference path (`backend/services/dehazing/refine.py` only loads weights, it never trains). See `training/train.py` for synthetic-data training and `training/revide.py` for fine-tuning on the paired REVIDE haze dataset, which is not included in this repo and must be downloaded separately.
