# Tasks

## 1. Edition API

- [x] 1.1 Add `server/lib/editions.js` with a pure `editionDate(title, publishedDate)` that returns `YYYY-MM-DD` from `MM.DD.YYYY` or `YYYY-MM-DD` in the title and falls back to the UTC date of `publishedDate`, plus a pure function that drops duplicates per region and date (most tracks, then latest `published_date`) and sorts by date then region order. Cover both in `server/lib/editions.test.js` with the three "Edition date" scenarios, the "Duplicate week" scenario and the "Index order" scenario, and verify the file passes
- [x] 1.2 Add `server/controllers/editions.js` with `index` (projects `title`, `region`, `published_date` and the track count, never the tracks) and `show` (404 `{ "error": "Not found" }` for an unknown or malformed id, 500 `{ "error": "Internal server error" }` on a query failure). Set `Cache-Control: public, max-age=300` on the index and `max-age=3600` on a single edition. Cover every scenario of "Edition index", "Single edition" and "Edition error response" in `server/controllers/editions.test.js`, mocking the model the way `playlist.test.js` does, and verify the file passes
- [x] 1.3 Register `GET /spotify/editions` and `GET /spotify/editions/:id` in `server/routes/playlist.js` behind a new limiter of 300 requests per 15 minutes, separate from `playlistLimiter`. Verify with `curl -i http://localhost:3000/spotify/editions` that the response is 200 with `RateLimit` headers showing a limit of 300, and that `GET /spotify` still reports 100
- [x] 1.4 Add the two endpoints to the "Playlist API" section of `CLAUDE.md` and verify the documented paths match the routes

## 2. Wall logic

- [x] 2.1 Add `client/src/lib/wall.js` with pure functions for: ISO week of a `YYYY-MM-DD` date, a local-midnight date parser and the "Weekday, Month day, year" formatter, building year rows for one region (later edition wins a shared week, December and January edge weeks stay in their calendar year's row), building week groups for ALL, brightness steps from the 5th–95th percentile, the nearest edition to a date (later wins a tie), previous and next edition within a region, and the headline numbers. Cover them in `client/src/lib/wall.test.js`, including the July 2015 same-week pair, a 53-week year, a missing week and the "Nearest edition opens" scenario, and verify `bun run test` passes
- [x] 2.2 Add a `useEditions` hook that fetches `/spotify/editions` once and exposes `{ editions, loading, error }`, and an edition loader that fetches `/spotify/editions/:id` and keeps results in a `Map` for the life of the page. Verify in the browser's network panel that switching region sends no request and reopening an edition sends none

## 3. Wall and panel UI

- [x] 3.1 Give `RegionProvider` a view-only override so a deep link can show another region as selected without writing `selectedRegion`, cleared when the visitor clicks a region button. Verify by loading `/?edition=<a UK id>` with `selectedRegion` set to US: UK is active and local storage still holds US
- [x] 3.2 Build `Archive`, `ScaleHeadline` and `WallControls`: loading, error and empty states with the existing strings, the headline with "Every Friday, preserved.", the Ko-fi link, "Jump to a date" and "Lucky dip". Verify against the "Archive scale headline" and "Loading, empty and error states" scenarios by hand at http://127.0.0.1:4200
- [x] 3.3 Build `Wall`: year rows newest first, month labels, tiles as buttons with the specified accessible names, empty slots, region accent color and brightness steps, the pulsing latest tile, roving tabindex with arrow keys, one delegated pointer handler for the ripple (fine pointer and no reduced motion only), and horizontal scrolling inside its container with sticky year labels. Verify with `agent-browser snapshot -i` that tile names match the spec, and at 390 pixels wide that the page itself does not scroll sideways
- [x] 3.4 Build `EditionPanel`: date title, region code in its accent color, track count, "Previous edition", "Next edition", "Close edition", Escape to close, the region buttons for an ALL week, `PlaylistDownload` in the header, the `TrackItem` list with one preview open at a time, `SavePlaylist` at the end, and the "Loading edition..." and failure texts. Verify by opening a 100-track edition, playing a track, stepping to the previous edition and closing with Escape
- [x] 3.5 Sync the open edition to `?edition=` with `history.replaceState`, open it on load, remove an unknown id, and close the panel when the region changes to one the open edition does not belong to. Verify each scenario of "Edition deep link" and "Changing region closes another region's edition" by hand
- [x] 3.6 Implement lucky dip: pick a random edition and track, run the tile highlight unless reduced motion is requested, open the edition, scroll the track into view and open its preview. Verify that one embed is open afterwards, and that with reduced motion emulated the edition opens with no highlight
- [x] 3.7 Mount `Archive` in `App.jsx` and delete `Hero.jsx`, `PlaylistList.jsx`, `PlaylistCard.jsx`, `Pagination.jsx`, `usePlaylists.js`, the unused `apiGet` helper and their CSS, moving the `.pcard-dl` styles to the panel header. Verify `bun run build` succeeds and `grep -rn "pcard\|Pagination\|usePlaylists" client/src` finds nothing but the moved save-button styles
- [x] 3.8 Check the finished page in `agent-browser` at 1440 and 390 pixels wide in ALL, US and a region with no local data (AU), with no console errors, and verify there is no noise or film-grain texture anywhere

## 4. E2E tests

- [x] 4.1 In `e2e/seed/seed.js`, give the editions that tests open fixed `_id` values and add the rows the new scenarios need: a same-week pair, a same-date duplicate and a title with no date. Update the header comment and its counts, keep the file plain ES5, and verify `bun run db:up` seeds without error
- [x] 4.2 Replace the card helpers in `e2e/tests/helpers.ts` with wall helpers: a tile name builder, and an "open edition" helper that loads `/?edition=<id>`. Verify `bunx tsc --noEmit` passes in `e2e/`
- [x] 4.3 In `e2e/tests/archive-browsing.e2e.ts`, delete the tests for the three removed requirements, update the tests for the four modified ones, and add one test per new scenario, each with the spec path, requirement and scenario named in the comment above it. Follow `.claude/rules/e2e.md`: about half driven by `agent.act` plus a locator assertion, keyboard and timed states scripted. Verify the file passes with `E2E_TELEMETRY_DISABLED=1 bunx e2e run tests/archive-browsing.e2e.ts`
- [x] 4.4 In `e2e/tests/playlist-export.e2e.ts`, switch every test from expanding a card to the "open edition" helper and update the two modified scenarios. Verify the file passes
- [x] 4.5 In `e2e/tests/playlist-api.e2e.ts`, add tests for the edition endpoint scenarios, including the 301st request and the separate-budget scenario, sending their own client address with `asClient`. Verify the file passes

## 5. Verification

- [x] 5.1 Run `bun run test` and verify the whole Vitest suite passes
- [x] 5.2 Run `bun run test:e2e` and verify the whole suite passes, reporting any 429 instead of changing a limit
- [x] 5.3 Run `openspec validate friday-wall --strict` and verify it passes

## Workflow follow-up

- Archive the change after review, which merges the three deltas into `openspec/specs/`.
- After archiving, edit the Purpose paragraphs of `openspec/specs/archive-browsing/spec.md` and `openspec/specs/playlist-export/spec.md` by hand: they still describe pagination and playlist cards.
- The prototype stays on branch `prototype/fun-ideas` as the primary source. It is not merged.
