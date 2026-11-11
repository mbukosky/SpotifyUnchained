# Design

## Context

See proposal.md for the motivation. The facts that shape the approach:

- `server/lib/sync.js` reads `GET /v1/playlists/{id}/tracks` every eight hours and maps each item to six fields. Each item's `track.album.images` (640, 300 and 64 px) is in that response and is discarded today.
- `server/controllers/editions.js` sends an edition's tracks as parallel columns and omits a column the client can derive.
- `client/src/lib/covers.js` (420 lines) is mostly the oEmbed queue: priority tiers, concurrency, 429 pause, localStorage. `CoverGrid.jsx` and `PlayerBar.jsx` read covers through `useCover(id)`. `PlayerBar.jsx` also reads the queue's `limited` flag to decide whether to hold a new embed.
- The archive holds 1,363 editions and about 94,000 distinct track ids (counted in a local copy of production). None has a cover stored.
- Production data cannot be rebuilt, so the backfill must be additive and reversible.

## Goals / Non-Goals

**Goals:**
- No request to Spotify from the browser to find a cover.
- Covers present in the first render after the edition response arrives, with no lookup wait.
- A backfill that can only add the `cover` field.

**Non-Goals:**
- Proxying or hosting the images. They still load from Spotify's CDN.
- Preventing a 429 on the player embed. That limit is Spotify's and per visitor; this change removes the cover lookups that used most of it.
- Covers in `GET /spotify`, the RSS feed, or the wall tiles.
- Refreshing a stored cover if Spotify later changes an album's image.

## Decisions

### Store the 300 px URL as a string on each track
`cover: String` in the track sub-schema, holding the full URL Spotify gives for the 300 px image (the widest image when there is no 300 px one, `''` when there is none).

- *Why 300 px:* it is what oEmbed returned, so the grid, the hover swap and the player thumbnail behave as measured in the hill climb. The client already derives the 64 px variant from a 300 px URL (`smallCover`), and that stays.
- *Why the full URL, not the image id:* a 40-character id would save about 24 bytes per track in MongoDB (roughly 3 MB over the archive) but ties the data to today's URL shape. Compression removes the repeated prefix from the API response either way.
- *Alternative, a separate `covers` collection keyed by track id:* one row per distinct track and no duplication across regions, but every edition read becomes a second query or a `$lookup`, and the edition cache hides most of the cost difference. Rejected for the extra moving part.

### Send covers as one more omittable column
`trackColumns` adds `cover: [...]` (URL or `null` per track) when any track has one, following the existing `uri`/`open_url` pattern. `buildEdition` adds `tracks.cover` to its projection. Editions not yet backfilled keep their current, smaller response.

`GET /spotify` adds `tracks.cover: 0` to its final `$project`, so the legacy list keeps its shape and size (the baseline measures its bytes).

### The client reads the cover from the track; the lookup queue is deleted
`useEditions.js` already turns columns into track objects; it adds `cover`. `CoverTile` and `PlayerBar` take `track.cover` instead of calling `useCover`. `covers.js` keeps `IMAGE_URL`, `smallCover`, `useSmallCovers`, `preloadImage` and `warmCovers` (preconnecting only to the image hosts), and loses the queue, `useCover`, `useLazyCovers`, `requestCover`, `cancelCovers`, the pause logic and the localStorage store.

- A stored URL is used as an image source only if it matches `IMAGE_URL` (https, Spotify's image hosts). Anything else is treated as no cover. `img-src` already enforces the same hosts.
- Off-screen tiles use `loading="lazy"` on the image, which replaces the queue's on-screen-first ordering.
- The grid renders its tiles first and adds the `<img>` elements in a task after that frame. Rendering them together cost about 55 ms per edition at 4x CPU throttling (found in task 6.2).
- *Alternative, keep oEmbed as a fallback for tracks without a stored cover:* it would cover the gap before the backfill and tracks the backfill missed, but it keeps all 420 lines, the localStorage use and the 429 exposure for exactly the editions (old, large) where it hurt. Rejected: the backfill runs before the release, and a track Spotify no longer has will fail oEmbed too.

### The player's rate-limit notice gets its own small state
With no lookups there is nothing to tell the player that Spotify is limiting, other than an embed failing. `PlayerBar.jsx` keeps a module-level "refused at" time: set when an embed misses its six-second ready deadline, cleared when an embed reports ready. A track opened within 30 seconds of it mounts the notice instead of an embed, and a timer mounts the embed when the 30 seconds end. "Try now" works as it does today. `useSpotifyLimited` and `reportSpotifyLimited` are removed with the queue.

- *Why a fixed 30 seconds, with no doubling:* the doubling existed to protect a queue of hundreds of lookups. One embed every 30 seconds is already gentle, and each failure re-arms the 30 seconds.

### Backfill through the Web API, in batches, track by track
`scripts/backfill-covers.js`, standalone like `scripts/backfill.js`:

1. Read every playlist's `_id` and `tracks.id`/`tracks.cover`; collect distinct ids lacking a cover.
2. Get a client-credentials token and call `GET /v1/tracks?ids=` with 50 ids per request (about 1,900 requests), one at a time, honouring `Retry-After` on 429 and refreshing the token on 401.
3. After each batch, write with one `updateMany` per track id, the batch's writes sent together: `{ _id: { $in: <playlists holding it> }, 'tracks.id': id }`, `{ $set: { 'tracks.$[t].cover': url } }`, `arrayFilters: [{ 't.id': id, 't.cover': { $in: [null, ''] } }]`. Only the `cover` field of matching array elements is touched, and progress survives an interruption.
4. Print the summary. `--dry-run` skips step 3's writes and counts them instead.

The image-choosing rule is one function in `server/lib/cover.js`, used by the sync and imported by the script (not from `sync.js`, whose config import would fail before the script could name a missing variable), so the sync and the backfill cannot drift.

- *Why not oEmbed from the script:* one request per track (94,000), unauthenticated and limited per IP, with no documented limit.
- *Why not rewrite each playlist's `tracks` array:* a whole-array write could drop or reorder tracks if the script had a bug. `arrayFilters` with `$set` cannot.
- *Checked on 2026-11-10 (task 1.1):* with the app's client credentials, `GET /v1/tracks?ids=`, `GET /v1/tracks/{id}` and the playlist tracks endpoint all answer 200 with `album.images` at 640, 300 and 64 px on `https://i.scdn.co`. The batch endpoint works, so the batch size is 50. Tracks from the oldest editions (2014) carry older image URLs (`/image/<40 hex>` with no `ab67616d00001e02` prefix); they are valid covers, but the client cannot derive a 64 px variant from them and uses the 300 px image.
- *If the batch endpoint stops being available to this app* (Spotify has been restricting Web API endpoints): the script falls back to `GET /v1/tracks/{id}`, one track per request. Same code path with a batch size of one, slower (hours, not minutes), no change to the specs.

### CSP
No new external domain. Web API image URLs are on `https://i.scdn.co`, already in `img-src`; `https://*.spotifycdn.com` stays for safety. `connect-src` drops `https://open.spotify.com` because nothing fetches from it any more; `frame-src` keeps it for the player.

## Risks / Trade-offs

- [The backfill corrupts archived tracks] → Writes are `$set` on one field through `arrayFilters`; `--dry-run` first; `mongodump` before the real run; the unit test asserts the exact update shape and that tracks with a cover are skipped.
- [Tracks removed from Spotify get no cover] → They show initials, as a failed lookup does now. The summary reports how many. Expected to be a small share, concentrated in the oldest editions.
- [A stored URL stops working if Spotify changes its image URLs] → These URLs have been stable for years and are what the Web API documents; the tile falls back to initials on an image error. Rerunning the backfill after an `$unset` would refresh them.
- [Edition responses grow] → About 1.5 kB compressed per 100 tracks, against roughly 100 saved oEmbed round trips. Re-measure the open-edition KPIs with `scripts/perf/flows.mjs`.
- [All of an edition's images now start together instead of trickling in behind lookups] → `loading="lazy"` limits it to tiles near the viewport, and the 64 px variant keeps bytes low at 1x. Measured: the on-screen tiles of a 149-track edition settle in about 0.66 s, and tile paint times are better than attempt 3.
- [The sync's re-write of the current week drops covers if run by old code after the backfill] → Only the current week is affected, and the new code's startup sync restores it.
- [The player embed can still be refused] → Unchanged from today; the notice and "Try now" remain.

## Migration Plan

1. Archive the `friday-wall` change so the requirements this change modifies are in the main specs.
2. Merge the code. Nothing reads `cover` until it exists, so the code is safe with or without the backfill.
3. `mongodump` the production `playlists` collection.
4. Run `node scripts/backfill-covers.js --dry-run` against production and check the counts against the archive size.
5. Run it for real. Spot-check a recent, an old and a 149-track edition through `GET /spotify/editions/{id}`.
6. Deploy. The startup sync writes covers for the current week.

**Rollback:** redeploying the previous build is enough to restore the old behaviour (it ignores the field). To remove the data as well: `db.playlists.updateMany({}, { $unset: { "tracks.$[].cover": "" } })`, or restore the dump.

## Open Questions

None. The one open question, how many archived tracks Spotify no longer returns, was answered by the local run on 2026-11-10 (task 4.3): of 91,493 distinct tracks, 91,476 got a cover and 17 did not (0.02%). The run made about 1,830 requests in ten minutes with no 429, changed no field other than `cover` (every playlist compared before and after), and a second run wrote nothing.
