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

## backfill-covers.js

One-time script that adds album cover URLs to tracks archived before the sync began storing them. For every track without a `cover` it looks the track up once through Spotify's Web API (`GET /v1/tracks?ids=`, 50 ids per request, application credentials) and sets `cover` on that track in every playlist that holds it, using the same image rule as the sync (300 px, else the widest).

It only ever sets `cover` on elements that have none (`updateMany` with `$set` through `arrayFilters`). It never changes another field, the order or number of tracks, or creates or deletes playlists. It is idempotent: a second run finds nothing to look up. On a Spotify 429 it waits for `Retry-After` and repeats the request; on any other error it exits non-zero and keeps the covers already written, and a rerun carries on from there. Tracks Spotify no longer returns stay without a cover.

### Usage

```bash
# 1. Production only: dump the collection first
mongodump --uri "$DB_URI" --collection playlists --out backup-before-covers

# 2. Dry run: looks tracks up, writes nothing, reports what it would update
node scripts/backfill-covers.js --dry-run

# 3. For real
node scripts/backfill-covers.js
```

It prints the distinct tracks looked up, covers found, tracks left without a cover, and playlists and tracks updated.

### Requirements

- `DB_URI`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the environment or a `.env` file; the script exits non-zero naming any that is missing

### Tests

The script tests are outside the Vitest `include` pattern, so run them with the default config:

```bash
bunx vitest run --config /dev/null scripts/backfill-covers.test.js
```

### Rollback

Removes the field and nothing else (restoring the dump is the fallback):

```js
db.playlists.updateMany({}, { $unset: { "tracks.$[].cover": "" } })
```
