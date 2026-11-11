# Proposal

## Why

The Friday Wall asks Spotify's oEmbed endpoint for each track's cover from the visitor's browser, one request per tile. A 149-track edition is 149 requests, and Spotify answers 429 once a visitor has made too many. The cover tiles then stay on initials and the player embed, which shares the same per-visitor limit, is refused as well. The weekly sync already downloads every track from Spotify's Web API, and that response carries the album image, so the browser never needs to ask.

## What Changes

- The sync stores each track's album cover URL (the 300 px image) alongside the fields it stores today.
- `GET /spotify/editions/{id}` returns the covers as a `cover` column, omitted when the edition has none.
- The cover grid and the player bar read the cover from the edition. The browser makes no oEmbed requests. A track with no stored cover shows the artist's initials, as a failed lookup does today.
- The lookup queue, its 429 pause and the `su:covers:v1` localStorage cache are removed. The 64 px image variant on small tiles stays.
- The player bar keeps its "Spotify is limiting requests" notice, driven only by the embed: after an embed is refused, tracks opened in the next 30 seconds show the notice instead of loading another embed.
- `https://open.spotify.com` leaves the `connect-src` list of the Content Security Policy (it stays in `frame-src` for the player).
- A one-time script, `scripts/backfill-covers.js`, fills in covers for the archive already stored (about 94,000 distinct tracks across 1,363 editions).
- `GET /spotify` (the legacy list) does not gain the new field.

### Production data

The backfill script writes to production MongoDB, which cannot be rebuilt.

- **How it writes:** for each archived playlist it sets `cover` on tracks that have none. It never creates, deletes or reorders playlists or tracks, and never changes any other field. It is idempotent and can be stopped and rerun. A `--dry-run` mode reports what it would write without writing.
- **Before running:** take a `mongodump` of the `playlists` collection.
- **Rollback:** `db.playlists.updateMany({}, { $unset: { "tracks.$[].cover": "" } })` removes the field and nothing else. The application treats a missing cover as "show initials", so a partial or reverted backfill is safe to serve. Restoring the dump is the fallback if anything else looks wrong.
- The sync's write is unchanged in kind: it already replaces the current week's track list every eight hours; the tracks now carry one more field.

## Capabilities

### New Capabilities
- `cover-backfill`: the one-time script that adds cover URLs to tracks already in the archive.

### Modified Capabilities
- `playlist-sync`: stored track fields gain `cover`.
- `playlist-api`: the single-edition response gains a `cover` column; the list response excludes the field.
- `archive-browsing`: track cover art comes from the edition, with no browser lookups; the player's rate-limit notice no longer depends on cover lookups.
- `service-runtime`: `connect-src` drops `https://open.spotify.com`.

The `playlist-api`, `archive-browsing` and `service-runtime` deltas modify requirements that the `friday-wall` change adds or rewrites ("Single edition", "Track cover art", "Track preview", "Content security policy"). `friday-wall` is complete but not archived, so it must be archived before this change is.

## Impact

- **Server:** `server/models/playlist.js` (track schema), `server/lib/sync.js` (track mapping), `server/controllers/editions.js` (projection and columns), `server/controllers/playlist.js` (exclude `cover` from the list), `server/app.js` (CSP).
- **Client:** `client/src/lib/covers.js` shrinks to the image-size helpers and the preconnect; `CoverGrid.jsx`, `PlayerBar.jsx`, `EditionPanel.jsx`, `Archive.jsx` and `hooks/useEditions.js` pass the stored cover through.
- **Scripts:** new `scripts/backfill-covers.js` with its test, standalone (not in `package.json` or the Vitest config), documented in `scripts/README.md`. `scripts/perf/flows.mjs` loses its oEmbed-based `covers` flow.
- **Tests:** unit tests for sync, editions and playlist controllers; the e2e seed gains covers; the two e2e tests added for the 429 notice are reworked.
- **External calls:** the backfill makes about 1,900 Web API calls (50 tracks each) with the app's existing client credentials, once. Visitors make about 100 fewer requests to Spotify per edition opened.
- **Payload:** an edition response grows by roughly 1.5 kB compressed per 100 tracks.
- **Privacy:** the site no longer stores track ids in localStorage, and no longer tells Spotify which tracks a visitor's screen shows (the images themselves still load from Spotify's CDN).
