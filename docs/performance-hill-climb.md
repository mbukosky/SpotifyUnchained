# Performance hill climb: Friday Wall

Goal: improve every KPI in `docs/performance-baseline.json` by at least 25%
against the baseline in `docs/performance-baseline.md`, in at most 5 attempts.
Each attempt is a fresh session that reads this file, makes changes, measures
with the unchanged scripts in `scripts/perf/`, and appends a section below.

## Rules for every attempt

- The baseline files and the four measuring scripts (`flows.mjs`, `api.mjs`,
  `lighthouse.mjs`, `compare.mjs`) stay as they are, so numbers stay comparable.
  New scenarios may be added only as new, separately named metrics.
- No gaming: a change must help a real visitor, not only the script.
- Keep the visual design, the animations' look, keyboard and screen-reader
  behaviour, and the response shape of the long-lived `GET /spotify` list API.
  The `/spotify/editions*` endpoints are new on this branch and may change
  shape, with `openspec/specs/` and the e2e tests updated to match.
- `bun run test` and `bun run test:e2e` must pass before measuring. The e2e run
  builds the client with a fake Spotify client id, so rebuild with
  `cd client && bunx vite build` before any perf run.
- No commits or pushes. Leave changes in the working tree.

## KPIs that cannot move 25% (known floors)

These are recorded so later attempts do not spend time on them.

- Any metric whose baseline is 0 (several `longTasks.tbt` cells).
- `lighthouse.desktop.tbt.median` (4 ms, range 0–16): noise.
- Region switch US → BR unthrottled and fast4g (17 ms): one 60 Hz frame.
- Cold edition open on fast4g (`open.*.fetchDone` / `tilesPainted`, about
  218–235 ms): the emulated network adds 165 ms to every request and the
  script clicks with no hover time, so the floor is about 170–185 ms (−20%
  at best) unless the data is already in the page before the click.
- API `p99` cells are the single slowest of 60 requests; treat as noise.

## Attempts

(Each attempt appends: what changed, the full `compare.mjs` table summarised by
group, KPIs at or past −25%, KPIs still short and why, regressions, and ranked
recommendations for the next attempt.)

## Attempt 1

Measured 2026-11-10 on the same machine as the baseline, exactly as in baseline
section 7 (Lighthouse 7 runs, `api.mjs` with `PERF_RESTART`, `flows.mjs --runs 30`
with `PERF_RESTART`, normal `vite build`). Full table:
`scripts/perf/results/compare-attempt-1.txt` (flows
`flows-1794332622182.json`, api `api-1794329792162.json`, Lighthouse
`lighthouse/summary-1794329521288.json`). `bun run test` 164/164 and
`bun run test:e2e` 146 passed, 1 skipped (pre-existing skip) before measuring.

### What changed

Client
- `client/index.html`: Google Fonts links removed. A small inline script starts `GET /spotify/editions` (and, on `?edition=`, that edition) while the bundle downloads, and leaves the promises in `window.__suEarly`; it records `su:index-loaded` itself.
- `client/src/assets/fonts/` (new, OFL): Unbounded and Sora self-hosted. The variable fonts are instanced to the weights used (Unbounded 300–800, Sora 300–600) and the Latin file is split into a core file (ASCII plus common punctuation; 27.3 + 19.7 kB) and a `latin-rest` file that loads only when such characters appear. Same families, same per-weight `@font-face` structure as Google's CSS, `font-display: swap`, latin-ext/cyrillic/vietnamese kept. `fonts.css` is imported from `main.jsx`.
- `client/vite.config.js`: never inline `.woff2` (a data URL is repeated in every `@font-face`).
- `client/src/hooks/useEditions.js`: picks up the early requests; `expandTracks()` rebuilds `{ id, name, artist, uri, open_url }` from the new column payload; `prefetchEditions()` (idle-time).
- `client/src/components/Archive.jsx`: `loadEdition(id)` starts in `open()` before the state update; a tile press or a 150 ms hover dwell starts the fetch too (`onIntent`).
- `client/src/components/EditionPanel.jsx`: once the open edition is in, previous and next are fetched while idle; Tuesday comes from the index's `tuesday` flag.
- `client/src/components/Wall.jsx`: rows are memoised on plain column numbers (selected, latest, Tab stop), so opening a tile re-renders one or two rows, not 636 buttons; hover dwell / pointer-down intent; `tuesday` flag.
- `client/src/lib/wall.js`: one `Intl.DateTimeFormat` per format and a per-date label cache (was a `toLocaleDateString` per tile per render).
- `client/src/index.css`: `.loading-state { min-height: 100vh }`, so the footer starts below the fold and the scrollbar is present from the first frame (the CLS source on both presets).

Server
- `server/lib/encodedResponse.js` (new): bodies encoded once (Brotli 11, gzip 9, identity) with a strong ETag, `Vary`, 304, q-value-aware encoding choice; bounded LRU+TTL cache with coalesced fills.
- `server/lib/archiveCache.js` (new): index (5 min), editions (400 entries, 1 h) and list (100 entries, 1 min) caches; `invalidateArchive()`.
- `server/controllers/editions.js`: index items `{ id, region, date, trackCount, tuesday? }` (title dropped); edition tracks as columns `{ id, name, artist }`, with full `uri`/`open_url` columns only if any stored value differs from `spotify:track:<id>` / `https://open.spotify.com/track/<id>` (true for all 134,564 tracks in the local DB, checked); `added_at` dropped; Mongo projection limited to the needed fields.
- `server/controllers/playlist.js`: `GET /spotify` cached and pre-encoded; body byte-identical to before (checked with `cmp` against the dev server).
- `server/lib/staticAssets.js` (new) + `server/app.js`: built HTML/JS/CSS/SVG compressed once at startup (Brotli 11) and served from memory; `/assets/*` gets `immutable, max-age=1y`; API paths skip the static handlers; CSP no longer lists Google Fonts hosts.
- `server/index.js`: waits (max 5 s) for static compression and the index warm-up before listening. `server/lib/sync.js`: clears the caches after each write.
- `server/routes/playlist.js`: edition limit 300 → **900** per 15 min, because an open can now cost up to three requests (open + two neighbour prefetches). Spec, unit and e2e tests updated.

Tests, specs, docs: `server/controllers/editions.test.js` and `playlist.test.js` rewritten for the encoded responses (HTTP-level; ETag/304, encodings, cache, column fallback, 900 limit); `e2e/tests/playlist-api.e2e.ts`, `service-runtime.e2e.ts`; `openspec/changes/friday-wall/{design.md,tasks.md,specs/playlist-api,specs/service-runtime}`; `CLAUDE.md` API section.

### Results (baseline → now)

Lighthouse (median of 7)

| Metric | desktop | mobile |
|--------|---------|--------|
| FCP | 182 → 97 ms (−46.5%) | 1,418 → 753 ms (−46.9%) |
| LCP | 182 → 186 ms (**+2.3%**) | 1,418 → 753 ms (−46.9%) |
| Speed Index | 912 → 825 ms (−9.5%) | 1,418 → 1,101 ms (−22.3%) |
| TBT | 4 → 0 ms (floor) | 64.5 → 24 ms (−62.8%) |
| CLS | 0.323 → 0 | 0.113 → 0 |
| Total transfer | 197,877 → 142,192 B (−28.1%) | same |

API (sequential p50; sizes)

| Endpoint | p50 | p95 | br bytes | raw bytes |
|----------|-----|-----|----------|-----------|
| index | 14.3 → 0.31 ms | 18.0 → 0.70 | 18,412 → 10,442 (−43%) | 163,009 → 111,657 (−32%) |
| edition 31 | 1.64 → 0.25 | 3.56 → 0.43 | 1,720 → 1,191 (−31%) | 7,262 → 1,926 (−73%) |
| edition 100 | 2.57 → 0.27 | 4.44 → 0.61 | 5,093 → 3,541 (−30%) | 23,093 → 5,820 (−75%) |
| edition 149 | 2.80 → 0.25 | 6.11 → 0.42 | 7,465 → 5,160 (−31%) | 34,682 → 8,932 (−74%) |
| edition 243 | 2.99 → 0.29 | 6.61 → 0.54 | 11,537 → 7,832 (−32%) | 55,505 → 13,493 (−76%) |
| `/spotify` p1 s5 | 5.61 → 0.31 | 9.0 → 0.74 | 11,286 → 9,755 (**−13.6%**, floor) | 69,037 → 69,037 (floor) |

Flows, p50 (ms)

| Cell | unthrottled | fast4g | fast4g-cpu4 |
|------|-------------|--------|-------------|
| wall drawn | 245 → 103 (−58%) | 735 → 544 (−26%) | 1,047 → 749 (−28%) |
| open 31 tiles painted | 99 → 66 (−34%) | 235 → 202 (−14%) | 386 → 245 (−37%) |
| open 100 tiles painted | 88 → 69 (−22%) | 226 → 207 (−8%) | 378 → 287 (−24%) |
| open 149 panel / tiles | 44.6 → 45.7 / 72 → 76 (**+**) | 43 → 39 / 228 → 229 | 104 → 65 / 397 → 323 (−19%) |
| deep link 31 / 100 / 149 tiles | 351/361/365 → 149/308/291 | 1,017/1,027/1,025 → 589/593/594 (−42%) | 1,520/1,561/1,595 → 997/990/1,027 (−35%) |
| previous (uncached before) | 70/73/75 → 38/41/43 (−44%) | 218/222/226 → 40/40/51 (−80%) | 302/311/329 → 236/212/230 (−22 to −32%) |
| next (cached) | 24/32/36 → 18/21/24 (−26 to −34%) | 25/31/35 → 18/21/24 (−28 to −30%) | 101/110/125 → 44/66/86 (−32 to −56%) |
| region ALL→US / US→BR | 74 → 64 (−13%) / 17 → 17 | 75 → 66 (−12%) / 17 → 17 | 235 → 153 (−35%) / 61 → 43 (−29%) |

### KPI count (192 metrics)

- **134** at −25% or better.
- **35** improved but short of −25% (list below).
- **11** with a baseline of 0 (TBT cells; floor) and **2** unchanged at known floors (`/spotify` bytesRaw, shape frozen; fast4g region BR p50, 17.3 ms, one frame).
- **10** worse than baseline: desktop LCP (+2.3%); unthrottled open-149 panel/fetch/tiles p50 (+2.5/+2.2/+5.1%) and tiles p95 (+10.1%); unthrottled region BR p95 (+66%, 19.1 → 31.7; p50 unchanged); fast4g open-149 tiles p50/p95 (+0.2/+1.9%); fast4g region US/BR p95 (+1.5/+1.6%). The p50 changes for open-149 are 1–4 ms and the fast4g p95 changes under 5 ms, likely noise; desktop LCP, the unthrottled open-149 tiles p95 and region BR p95 look real (min–max spread not checked cell by cell).

Short of −25%: Lighthouse SI desktop (−9.5%) and mobile (−22.3%); `/spotify` bytesCompressed (−13.6%, floor); unthrottled open-100 tiles, open-149 p95s, deep links 100/149 (p50 −15/−20%, p95s), region US (p50/p95); fast4g open fetchDone/tilesPainted for all three (−4 to −16%, the known network floor), fast4g open-149 panel and open-100 panel p95; cpu4 open-100 tiles (−24.1%), open-149 fetch/tiles, previous-31.

### Notes on the cells the lead flagged, and what behaved differently

- **Unthrottled open on the BR wall (149).** The wall-side gains (row memo, fetch at click) do not apply here: the BR wall has 136 tiles and the request already finished in ~8 ms. Click → panel is dominated by the first frame after the click, and a trace showed ~20–25 ms inside `BeginMainFrame` with no attributable main-thread work, plus the hover ripple/tooltip work that Playwright's click (move + down + up at once) puts in the same frame. A JS `element.click()` without the pointer move paints the panel in 17–32 ms. Not fixed. The +10% tiles p95 was not diagnosed; the idle neighbour prefetch (two requests and JSON parses shortly after the open) is a candidate, not verified.
- **Region switch** (unthrottled/fast4g) moved only −12/−13% for US and not at all for BR: the cost is mounting 636 (or 136) freshly animated buttons and the frame that follows, which this attempt did not change (WallRows still remounts by design). The BR p95 rise (19.1 → 31.7) comes from a few slow frames; p50 is 16.8. Not diagnosed.
- **Desktop LCP.** The LCP element used to be the footer paragraph, painted with the first render. With the loading state now holding 100vh (the CLS fix), the footer starts below the fold, and LCP becomes the wall legend (`.wall-legend-scale`), which paints with the wall (~186 ms). The headline spans start at opacity 0 (rise animation) and are not LCP candidates. So the CLS fix (0.323 → 0) traded off ~80 ms of desktop LCP.
- **Speed Index.** Bounded by the wall's entrance stagger (up to ~1.5 s after the wall paints), which must not change; earlier wall paint is the only lever.
- **Font preload made mobile worse.** Preloading the two core fonts put 49 kB in competition with the 66 kB bundle under Lighthouse's simulated 1.6 Mbps link (mobile FCP ~1,209 ms with preload vs 753 without). Fonts now load when text first lays out, as the Google font files did before. Visible effect: a font swap after first paint (CLS 0.0004, measured).
- **Rendering the wall in the very first React render** (when the early index is already parsed) made things worse: desktop FCP 290–390 ms (text waits for fonts discovered in a much heavier first frame), mobile TBT 85 ms, and no gain in `wallDrawn`. Kept the spinner-first render.
- **Lazy-loading the panel** moved only 18 kB raw / 6.4 kB gzip out of 241 kB (React is the bulk), so it was dropped as not worth the deep-link risk.
- **Inconclusive experiments** (measured against a stray server, see below): `wall-pop` with `backwards` fill / dropping finished animations to release ~636 compositor layers, and drawing the mesh canvas at quarter resolution. Neither is in the patch; both deserve a clean re-test.
- **Measurement hazard found:** killing `flows.mjs` mid-phase can leave a server on port 3100 that is not in the pidfile; `server.sh start` then sees `/health` answer and reports "up" while every later run hits the stale build. Check `lsof -iTCP:3100` before trusting a run.

### Known floors (additions)

- `api.list-page1-size5.bytesCompressed`: Brotli 11 on the frozen body gives 9,755 B (−13.6%); key reordering is ruled out by the byte-for-byte rule.
- Lighthouse desktop LCP is now tied to the wall's first paint (the legend), not first paint; it cannot reach 136 ms without the wall painting by then.

### Recommendations for attempt 2 (ranked)

1. **Cut the cost of the frame after a click / region switch** (unthrottled open-149, region US/BR, open-100 tiles). Re-test, on a clean server, ending finished `wall-pop` animations (e.g. mark tiles on `animationend` with a data attribute React never writes, and give `[data-in]` `animation: none; opacity: 1`) to release ~636 compositor layers, and compare `open` and `region` with a CDP trace. Watch the trade-off: un-layered tiles repaint 636 blurred `box-shadow`s on any wall invalidation. Expected: panel painted unthrottled ~45 → ~30 ms if the opaque ~20 ms frame is layer commit. Evidence: trace in this attempt (20–25 ms unattributed `BeginMainFrame` after the click; JS click without hover 17–32 ms).
2. **Desktop LCP and Speed Index: paint the wall earlier.** Options: server-render the wall markup (the server already holds the encoded index) into `index.html` and hydrate, so wall + legend are in the first paint; or cut wall mount cost (636 buttons with inline style objects and labels; precompute row markup per region). Expected: desktop LCP ~186 → ~100–120 ms, SI down with it. Evidence: LCP element is `.wall-legend-scale`, painted ~80 ms after FCP.
3. **Mobile SI (1,101 vs 1,063 target):** same lever as 2; also check whether the 9 kB render-blocking CSS can be inlined for first paint (Lighthouse estimates 150 ms render-blocking).
4. **Unthrottled deep links (100/149, bimodal ~150 vs ~300 ms):** the panel paints during the wall's entrance animation frames; try opening the panel in the same commit as the wall (deep-link id known before the index resolves) or deferring the panel's cover grid by one frame. Evidence: deeplink p50 149 (31) vs 308 (100) with similar data timing.
5. **fast4g open fetchDone/tilesPainted** stays on the network floor (~187–192 ms) in this script; only hover/press prefetch (already in) helps real visitors. Do not spend more here.
6. Skip: bundle code-splitting (little to gain), API latency (already ~0.3 ms).
