# [Unchaining Spotify](https://spotifyunchained.com)

Never lose a playlist again. A simple site that automatically archives Spotify's [New Music Friday](https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk) playlists (US,UK,CA,BR,MX,DE) before they refresh weekly.

This is not an official Spotify application. I am a developer, Spotify user, and here is my solution.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Backend**: Node.js with Express.js (ESM)
- **Database**: MongoDB with Mongoose 7
- **Package Manager**: Bun
- **Deployment**: Heroku

## Development Setup

### Prerequisites

- Node.js >= 20.x
- [Bun](https://bun.sh)
- MongoDB (or use Docker: `docker compose up -d`)

### Getting Started

```bash
# Install dependencies
bun install

# Start MongoDB
docker compose up -d

# Run in development mode (server + client)
bun run dev
```

### Production Build

```bash
bun run build
bun run start
```

## Social

- [spotifyunchained.com](https://spotifyunchained.com)
- SpotifyUnchained@gmail.com

## License

(MIT)
