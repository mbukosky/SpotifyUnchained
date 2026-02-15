# Scripts

## backfill.js

Backfills historical New Music Friday playlists by reconstructing weekly snapshots from [mackorone/spotify-playlist-archive](https://github.com/mackorone/spotify-playlist-archive) cumulative data. Idempotent — safe to re-run.

**Regions:** UK, CA, BR, MX, DE

### Usage

```bash
# Default: 50 weeks
node scripts/backfill.js

# Custom range
BACKFILL_WEEKS=200 node scripts/backfill.js
```

### Requirements

- `DB_URI` environment variable (or `.env` file)
- No Spotify credentials needed — data comes from GitHub
