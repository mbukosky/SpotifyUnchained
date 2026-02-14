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
- **Monitoring**: New Relic APM + Google Analytics 4
- **Deployment**: Heroku (Bun + Node.js buildpacks)

### Project Structure
```
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (useSpotifyAuth, etc.)
│   │   ├── lib/              # Utility libraries (spotify API client)
│   │   └── pages/            # Page components
│   ├── index.html            # Entry HTML (GA4 + New Relic snippets)
│   └── vite.config.js        # Vite configuration
├── server/                    # Express.js backend (ESM)
│   ├── app.js                # Express app setup (helmet, CORS, rate limiting)
│   ├── config.js             # Configuration + env var validation
│   ├── index.js              # Server entry point
│   ├── controllers/          # Route handlers
│   ├── models/               # Mongoose schemas
│   └── routes/               # API route definitions
├── scripts/                   # Utility scripts
├── package.json              # Root package.json (Bun scripts)
├── bun.lock                  # Bun lockfile
├── Procfile                  # Heroku: web: bun run start
├── newrelic.cjs              # New Relic configuration
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
- `NEW_RELIC_LICENSE_KEY` - New Relic APM license key
- `NEW_RELIC_LOG` - New Relic log level

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

### Heroku
- **Buildpacks**: `jmlow/heroku-buildpack-bun` + `heroku/nodejs`
- **Stack**: heroku-22
- **Procfile**: `web: bun run start`
- Configure env vars in Heroku dashboard or via `heroku config:set`
- `heroku-postbuild` script handles client build

### Local MongoDB
```bash
docker compose up -d   # MongoDB 5.0 on port 27017
```
