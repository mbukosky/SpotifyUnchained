# Tasks

## 1. Confirm the data source

- [x] 1.1 With the app's client credentials, call `GET /v1/tracks?ids=` for two known track ids and `GET /v1/playlists/{id}/tracks?limit=1` for the US playlist; verify both return `album.images` with a 300 px entry on `https://i.scdn.co`, and record in design.md whether the batch endpoint works (if it answers 403 or 404, the backfill uses `GET /v1/tracks/{id}` with a batch size of one)

## 2. Store covers at sync

- [x] 2.1 Add `cover: String` to the track sub-schema in `server/models/playlist.js`; verify `bun run test` still passes
- [x] 2.2 Export a cover-choosing function from `server/lib/sync.js` (defined in `server/lib/cover.js`, which has no imports, so the script can load it without the server's config) (300 px image, else the widest, else `''`) and use it in `fetchPlaylistTracks`; verify with new cases in `server/lib/sync.test.js` for the three "Stored track fields" cover scenarios
- [x] 2.3 Update the Playlist model block in `CLAUDE.md` with the `cover` field; verify it matches the schema

## 3. Serve covers

- [x] 3.1 Add `tracks.cover` to the projection in `buildEdition` and a `cover` column to `trackColumns` (full array with `null`, omitted when no track has a cover); verify with new cases in `server/controllers/editions.test.js` for "Covers sent as a full column" and "No covers stored", and that the existing cases pass
- [x] 3.2 Exclude `tracks.cover` from `GET /spotify` in `server/controllers/playlist.js`; verify with a new case in `server/controllers/playlist.test.js` that the aggregate pipeline projects it out
- [x] 3.3 Remove `https://open.spotify.com` from `connectSrc` in `server/app.js`; verify `server/app.test.js` asserts the new `connect-src` list
- [x] 3.4 Update the edition endpoint description in `CLAUDE.md` with the `cover` column; verify it matches the response

## 4. Backfill script

- [x] 4.1 Write `scripts/backfill-covers.js` as design.md describes (distinct ids without a cover, batched Web API lookups, `Retry-After`, per-track `updateMany` with `arrayFilters`, `--dry-run`, summary, missing-variable check), standalone and not referenced from `package.json` or `vitest.config.js`
- [x] 4.2 Write `scripts/backfill-covers.test.js` with a mocked `fetch` and a mocked collection, one case per scenario in `specs/cover-backfill/spec.md`, including an assertion on the exact update document and array filter; verify with `bunx vitest run --config /dev/null scripts/backfill-covers.test.js` (the script tests are outside the Vitest config's include pattern)
- [x] 4.3 Run the script against the local Docker Mongo (`spotifyunchained` database on 27017), first with `--dry-run`, then for real, then a second time; verify the second run writes nothing, that track counts and order per playlist are unchanged (compare an aggregate of `{_id, n: {$size: '$tracks'}, ids: '$tracks.id'}` before and after), and record the share of tracks left without a cover in design.md's open question
- [x] 4.4 Document the script in `scripts/README.md` (usage, `--dry-run`, required variables, the dump-first step and the `$unset` rollback); verify the documented commands run as written

## 5. Client

- [x] 5.1 Carry `cover` from the edition columns onto each track in `client/src/hooks/useEditions.js`; verify in the browser that `tracks[0].cover` is set for a backfilled local edition
- [x] 5.2 Make `CoverTile` in `CoverGrid.jsx` and the thumbnail in `PlayerBar.jsx` use `track.cover` (validated against `IMAGE_URL`, `loading="lazy"` on tile images, 64 px variant and hover swap kept); verify covers show on first render of a backfilled edition and initials show for a track with no cover
- [x] 5.3 Delete the lookup queue, the 429 pause, the localStorage store, `useCover`, `useLazyCovers`, `requestCover`, `cancelCovers`, `useSpotifyLimited` and `reportSpotifyLimited` from `client/src/lib/covers.js`, and limit `warmCovers` to the image hosts; verify `bunx vite build` succeeds and `grep -r oembed client/src` finds nothing
- [x] 5.4 Give `PlayerBar.jsx` its own refused-embed state (30 seconds after a missed ready deadline, cleared by a ready embed or "Try now"); verify with a Playwright route that answers the embed URL with a 429 page that the notice, the held next track and "Try now" behave as the "Track preview" requirement says
- [x] 5.5 Add covers to most tracks in `e2e/seed/seed.js`, leaving at least one track per seeded edition without one; verify the seed loads with `bun run db:up` from `e2e/`
- [x] 5.6 Update `e2e/tests/archive-browsing.e2e.ts`: one test each for "Cover loads", "No lookups from the browser" (fail on any request to `/oembed`) and "Cover unavailable", and rework the two 429 tests to the new "Spotify refuses the embed" and "Spotify is limiting requests" scenarios; add a `playlist-api` e2e case for the `cover` column and for its absence from `GET /spotify`; verify with `bun run test:e2e`

## 6. Integration checks

- [x] 6.1 Run `bun run test` and `bun run test:e2e`; verify both pass, then rebuild the client with `bun run build`
- [x] 6.2 Point the `covers` flow in `scripts/perf/flows.mjs` at the stored cover images instead of oEmbed (and answer cover images locally in the other flows), rerun `flows.mjs` and `api.mjs` on the backfilled local data and compare with attempt 3 using `compare.mjs`; verify edition-open and 149-tile numbers are no worse, and add the result to `docs/performance-hill-climb.md`
- [x] 6.3 Open a 149-track edition at `http://127.0.0.1:3000` in a fresh browser profile with the network panel open; verify every backfilled tile shows its cover and no request goes to `open.spotify.com` until a track is played
- [x] 6.4 Run `openspec validate store-cover-art --strict`; verify it passes

## Workflow follow-up

- Archive the `friday-wall` change before archiving this one.
- Production: `mongodump` the `playlists` collection, run `node scripts/backfill-covers.js --dry-run`, review the counts, run it for real, spot-check three editions, then deploy.
- Archive this change once the production backfill is confirmed.
