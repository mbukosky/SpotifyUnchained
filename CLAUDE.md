# SpotifyUnchained - Development Guide

## Project Overview

SpotifyUnchained is a web application that automatically archives Spotify's "New Music Friday" playlists before they refresh weekly. This ensures music lovers never lose track of previously featured songs.

**Key Features:**
- Automatically archives Spotify's New Music Friday playlist (US, UK, CA, BR, MX, DE, and AU — Australia & New Zealand share one playlist)
- Web interface to browse historical playlist archives
- Spotify OAuth (PKCE) integration for playlist export
- Dark theme UI with per-region accent colors
- RESTful API with pagination and sorting
- Scheduled playlist synchronization via node-cron

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Backend**: Node.js with Express.js (ESM)
- **Database**: MongoDB with Mongoose 7
- **Package Manager**: Bun
- **Testing**: Vitest
- **Monitoring**: Google Analytics 4
- **Deployment**: Railway (Railpack)

### Project Structure
```
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (useSpotifyAuth, etc.)
│   │   ├── lib/              # Utility libraries (spotify API client)
│   │   └── pages/            # Page components
│   ├── index.html            # Entry HTML (GA4 snippet)
│   └── vite.config.js        # Vite configuration
├── server/                    # Express.js backend (ESM)
│   ├── app.js                # Express app setup (helmet, CORS, rate limiting)
│   ├── config.js             # Configuration + env var validation
│   ├── index.js              # Server entry point
│   ├── controllers/          # Route handlers
│   ├── models/               # Mongoose schemas
│   └── routes/               # API route definitions
├── scripts/                   # Utility scripts
├── openspec/                  # Behavior specs and proposed changes (OpenSpec)
├── vitest.config.js           # Vitest configuration
├── package.json              # Root package.json (Bun scripts)
├── bun.lock                  # Bun lockfile
├── railway.toml              # Railway deployment config
└── docker-compose.yml        # Local MongoDB via Docker
```

## OpenSpec

`openspec/specs/` is the source of truth for current behavior. Start new features and behavior changes with `/opsx:propose`; go straight to code for small fixes and one-time scripts.

## Development Setup

### Prerequisites
- Node.js >= 18.x
- Bun (package manager)
- MongoDB (running on default port 27017, or use `docker compose up -d`)

### Environment Variables
Copy `.env.example` to `.env` and fill in values.

**Required:**
- `DB_URI` - MongoDB connection string
- `SPOTIFY_CLIENT_ID` - Your Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Your Spotify app client secret

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `SKIP_SPOTIFY_SYNC` - Set to `true` to disable automatic sync
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `ALLOWED_REDIRECT_URIS` - Comma-separated OAuth redirect URIs
### Installation & Setup

1. **Install dependencies:**
   ```bash
   bun install
   cd client && bun install
   ```

2. **Start MongoDB (via Docker):**
   ```bash
   docker compose up -d
   ```

3. **Development Mode:**
   ```bash
   bun run dev    # Starts both server (port 3000) and client (Vite dev server)
   ```

4. **Production Mode:**
   ```bash
   bun run build   # Build React client
   bun run start   # Start Express server (serves built client)
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start both server and client in dev mode (concurrently) |
| `bun run dev:server` | Start Express server with --watch |
| `bun run dev:client` | Start Vite dev server |
| `bun run build` | Build React client for production |
| `bun run start` | Start Express server (production) |
| `bun run test` | Run backend tests (Vitest) |
| `bun run test:watch` | Run tests in watch mode |

## Testing

Backend tests use **Vitest** with test files co-located next to source files (`server/**/*.test.js`). The `vitest.config.js` sets required env vars so `config.js` loads without a real `.env` file.

- **Test pattern**: `server/**/*.test.js`
- **Coverage areas**: Sync logic (date math, track fetching), playlist controller (pagination, filtering), OAuth controller (token exchange/refresh)
- **Mocking**: `vi.mock()` for Mongoose models, `vi.stubGlobal('fetch')` for Spotify API calls, `vi.useFakeTimers()` for date-dependent logic

## E2E Tests

`e2e/` runs browser and HTTP tests against a real server and a throwaway seeded Mongo on port 27018, with one test per scenario in `openspec/specs/`. `.claude/rules/e2e.md` holds the rules for working in that folder.

- **Full run:** `bun run test:e2e` rebuilds the client with a fake Spotify client ID, reseeds Mongo and runs the suite under Node 22. Rebuild with `bun run build` before using `bun run start` locally.
- **One file:** from `e2e/`, `bun run db:up`, then `E2E_TELEMETRY_DISABLED=1 bunx e2e run tests/<file>`. `bun run db:down` when finished.

## API Endpoints

### Playlist API
- `GET /spotify` - List archived playlists
  - Query params: `page`, `size`, `sort` (asc/desc), `region` (US/UK/CA/BR/MX/DE/AU)
  - Tracks do not include `cover` (use the edition endpoint)
  - Returns paginated playlist data with track information
- `GET /spotify/editions` - Every archived edition as `{ items: [{ id, region, date, trackCount, tuesday? }] }`, no tracks or titles
  - `date` is `YYYY-MM-DD` from the title (falls back to the UTC `published_date`); one item per region and date, sorted by date then region
  - `tuesday: true` only on New Music Tuesday editions
  - Rate limited separately (900 per 15 minutes, shared with the edition endpoint; the client prefetches the open edition's neighbours)
- `GET /spotify/editions/:id` - One edition `{ id, title, region, date, tracks }` with `tracks` as columns `{ id: [], name: [], artist: [] }`; `uri`/`open_url` columns only when some stored value differs from `spotify:track:<id>` / `https://open.spotify.com/track/<id>`; a `cover` column (URL or `null` per track) only when some track has a stored cover; 404 `{ "error": "Not found" }` for an unknown or malformed id
- The index, editions and `GET /spotify` pages up to 128 kB are served from an in-memory cache, pre-compressed (Brotli 11, gzip 9) with a strong ETag (larger `/spotify` pages go through the compression middleware uncached); a sync write clears it (`server/lib/archiveCache.js`)

### Spotify OAuth API
- `POST /api/spotify/token` - Exchange authorization code for tokens (PKCE)
- `POST /api/spotify/refresh` - Refresh access token

## Database Schema

### Playlist Model
```javascript
{
  title: String,          // e.g., "New.Music.Friday.US.02.14.2026"
  region: String,         // US, UK, CA, BR, MX, DE, or AU
  published_date: Date,
  tracks: [{
    id: String,           // Spotify track ID
    name: String,
    artist: String,
    added_at: Date,
    open_url: String,     // Spotify web URL
    uri: String,          // Spotify URI
    cover: String,        // Album image URL (300 px, else widest, else ''); set by the sync and scripts/backfill-covers.js
  }]
}
```

## Security

- **Helmet** with Content Security Policy (CSP)
- **CORS** restricted to configured origins
- **Rate limiting** on API routes and `/spotify` endpoint
- **OAuth state parameter** for CSRF protection
- **Tokens in sessionStorage** (cleared on tab close)
- **Body size limit** (10kb) on JSON parsing
- **Env var validation** at startup (fail-fast)
- **Sanitized error responses** (no raw upstream errors exposed)

## Deployment

### Railway
- **Builder**: Railpack (auto-detects Bun from `bun.lock`)
- **Config file**: `railway.toml`
- Configure env vars in Railway dashboard

### Local MongoDB
```bash
docker compose up -d   # MongoDB 5.0 on port 27017
```
