# Golf Practice Tracker

Track practice time per category and holes played, on a weekly (Monday–Sunday) basis. React + Vite PWA frontend, Express + PostgreSQL backend, single Docker image for deployment.

## Stack

- **client** — React 18 + TypeScript + Vite, installable PWA (`vite-plugin-pwa`)
- **server** — Express + TypeScript, JWT auth via httpOnly cookie, PostgreSQL (`pg`)
- **shared** — TypeScript types and week-boundary logic shared by both

In production, Express serves the built client and the API from the same origin (no CORS) out of a single container.

## Local development

### 1. Postgres

Use your own local Postgres, or start one with Docker:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with database/user/password all `golftracker` (matching `.env.example`).

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env` if your database connection differs from the default.

### 3. Install & migrate

```bash
npm install
npm run build:shared   # shared types must be compiled before the server/client can import them
npm run migrate         # creates tables
```

### 4. Run

In two terminals:

```bash
npm run dev:server   # http://localhost:3000 (API)
npm run dev:client   # http://localhost:5173 (Vite dev server, proxies /api to :3000)
```

Open http://localhost:5173, register an account, and start logging practice sessions and rounds. Install it to your phone's home screen from the browser's "Add to Home Screen" / "Install app" menu once you deploy it (PWA install prompts require HTTPS, which Fly.io provides).

## Production build

```bash
npm run build   # builds shared -> server -> client (client output lands in server/client-dist)
npm start        # runs the compiled server, serving API + static client on one port
```

## Deploying to Fly.io

The `Dockerfile` builds a single image (multi-stage: install → build → slim runtime) that runs the Express server, which serves both the API and the built client.

1. **Install flyctl** and log in: https://fly.io/docs/flyctl/install/
2. **Create the app** (pick a unique name; update `app` in `fly.toml` to match):
   ```bash
   fly launch --no-deploy
   ```
3. **Attach Postgres**:
   ```bash
   fly postgres create --name golftracker-db
   fly postgres attach golftracker-db
   ```
   This sets the `DATABASE_URL` secret on your app automatically.
4. **Set the JWT secret**:
   ```bash
   fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
   ```
5. **Deploy**:
   ```bash
   fly deploy
   ```
   The `release_command` in `fly.toml` runs database migrations automatically before each new release goes live.

`COOKIE_SECURE=true` is already set in `fly.toml` so the auth cookie requires HTTPS, which Fly's proxy provides by default.

## Data model

- **categories** — user-defined practice categories (name, color, optional weekly time goal in minutes, archivable)
- **practice_sessions** — category + duration (minutes) + date + optional notes
- **rounds** — holes played + date + optional notes

A category with logged sessions can be archived but not deleted (to preserve history); it still shows up in weeks where it has data even after archiving.

Weeks run Monday–Sunday. The dashboard shows the current week by default with prev/next navigation; totals are raw time (e.g. "1h 45m"), not a completion percentage.
