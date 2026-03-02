# SpotifyUnchained - Development Guide

## Project Overview

SpotifyUnchained is a web application that automatically archives Spotify's "New Music Friday" playlists before they refresh weekly. This ensures music lovers never lose track of previously featured songs.

**Key Features:**
- Automatically archives Spotify's New Music Friday playlist (US & UK regions)
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
├── vitest.config.js           # Vitest configuration
├── package.json              # Root package.json (Bun scripts)
├── bun.lock                  # Bun lockfile
├── railway.toml              # Railway deployment config
└── docker-compose.yml        # Local MongoDB via Docker
```

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

## API Endpoints

### Playlist API
- `GET /spotify` - List archived playlists
  - Query params: `page`, `size`, `sort` (asc/desc), `region` (US/UK)
  - Returns paginated playlist data with track information

### Spotify OAuth API
- `POST /api/spotify/token` - Exchange authorization code for tokens (PKCE)
- `POST /api/spotify/refresh` - Refresh access token

## Database Schema

### Playlist Model
```javascript
{
  title: String,          // e.g., "New.Music.Friday.US.02.14.2026"
  region: String,         // "US" or "UK"
  published_date: Date,
  tracks: [{
    id: String,           // Spotify track ID
    name: String,
    artist: String,
    added_at: Date,
    open_url: String,     // Spotify web URL
    uri: String,          // Spotify URI
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
