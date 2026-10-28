# Scripts

## backfill.js

Backfills historical New Music Friday playlists by reconstructing weekly snapshots from [mackorone/spotify-playlist-archive](https://github.com/mackorone/spotify-playlist-archive) cumulative data. Insert-only and idempotent — existing playlists (including ones saved by the live sync) are never overwritten, so it is safe to re-run.

Weeks are counted back from the archive's last recorded change for each region, not from today, because the upstream archive stopped tracking these playlists around Dec 2025 / Jan 2026.

**Regions:** UK, CA, BR, MX, DE, AU

### Usage

```bash
# Default: 50 weeks
node scripts/backfill.js

# Custom range
BACKFILL_WEEKS=200 node scripts/backfill.js

# Only some regions
BACKFILL_REGIONS=AU node scripts/backfill.js
```

### Requirements

- `DB_URI` environment variable (or `.env` file)
- No Spotify credentials needed — data comes from GitHub
