# Proposal

## Why

`syncPlaylist` writes whatever `fetchPlaylistTracks` returns, and the sync re-runs every 8 hours against the same week's record. One successful but empty Spotify response, whether an empty `items` array or items whose `track` is null, replaces a correctly archived week with an empty track list. Archived weeks can't be re-fetched, so the only remaining copy would be a database backup (issue #169). This has been reproduced in unit tests but isn't known to have happened in production.

## What Changes

- When a fetch returns no storable tracks, the sync skips that region's write: an existing archive stays unchanged, and no archive is created for a new week.
- The sync logs a warning naming the skipped archive title.
- The skip returns normally instead of throwing, so the remaining regions in the same run still sync.
- A response with at least one storable track behaves as before: it upserts and replaces the full track list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `playlist-sync`: adds a requirement that an empty fetch neither creates nor modifies an archive, and qualifies the "Full run" scenario, which currently promises one write per region on every error-free run.

## Impact

- **Code:** `server/lib/sync.js` (`syncPlaylist`) and `server/lib/sync.test.js`. The repro tests are already on branch `fix/issue-169-empty-sync`.
- **APIs and the UI:** no change. An empty week is simply never stored.
- **Production data:** no migration or backfill. The change only stops a destructive write and never writes anything new. To roll back, revert the commit.
- **Out of scope:** thresholds for partial responses, isolating failures between regions, and checking production for weeks that were already emptied.
