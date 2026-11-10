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

## Attempt 2

Measured 2026-11-10 on the same machine, exactly as in baseline section 7
(Lighthouse 7 runs, `api.mjs` with `PERF_RESTART`, `flows.mjs --runs 30` with
`PERF_RESTART`, normal `vite build`, port 3100 checked free before starting).
Full table: `scripts/perf/results/compare-attempt-2.txt` (flows
`flows-1794342152098.json`, api `api-1794339412182.json`, Lighthouse
`lighthouse/summary-1794339156028.json`). `bun run test` 165/165 and
`bun run test:e2e` 146 passed, 1 skipped (pre-existing) before measuring.

The lead changed `server/controllers/playlist.js` (and added a test) during
this attempt, after a security review: `GET /spotify` pages whose JSON body is
over 128 kB are no longer pre-encoded (Brotli 11) or cached, and go through the
compression middleware as before attempt 1, so a visitor cannot make the
server encode and hold megabyte pages. Smaller pages (the measured default
5-playlist page is ~70 kB) keep the cache, ETag and 304. The change was in
place for the e2e run and the measurement. This attempt updated the wording
to match in `openspec/changes/friday-wall/specs/playlist-api/spec.md`,
`openspec/changes/friday-wall/design.md` and `CLAUDE.md`; no e2e test asserts
an ETag on `/spotify`, so none changed.

### What changed

Client only.

- `client/src/components/EditionPanel.jsx`: an edition already in the page cache is taken during render (`peekEdition`), so its tiles commit together with the heading instead of one render (and, on a busy frame, one paint) later. Applies to deep links, prefetched neighbours, and editions opened before. The later promise result no longer re-sets identical state.
- `client/src/hooks/useEditions.js`: `peekEdition(id)` (editions that have arrived, readable during render); `adoptLinkedEdition()` picks up index.html's early deep-link request at mount, so it is parsed and cached while the index is still loading; `prefetchEditions` now starts right after the next paint (rAF, then `setTimeout 0`) instead of `requestIdleCallback`. The idle callback got no idle time at 4x CPU while the cover animation ran, so Previous found nothing cached.
- `client/src/components/Archive.jsx`: on a deep link, `openId` starts as `?edition=`, so the panel mounts in the same commit as the wall. Until the index confirms it, the edition shows only on a wall that holds it; a deep link's own switch to its edition's region no longer counts as a region pick that closes the panel; an unknown id clears `openId` as well as the URL.
- `client/src/components/Wall.jsx`: on `pointerover`, the hover card's geometry is read before the ripple writes its ~28 `--lift` values, so the read no longer forces a style and layout pass; one `MediaQueryList` per query instead of two `matchMedia` calls per tile crossed. Not separately measurable in the flows (Playwright's click puts hover and click in one frame either way); kept for real pointer movement.
- `client/vite.config.js`: a small build plugin inlines the app's stylesheet into `index.html` as a `<style>` element (43.8 kB raw, ~9 kB compressed; CSP already allows inline styles). Trade-off: the CSS comes with every HTML load instead of from the immutable asset cache.

No test, spec or e2e change was needed: the spec's "Loading edition..." applies while an edition is being fetched, and a cached edition is not.

### Results (baseline → attempt 1 → now)

Lighthouse (median of 7; min–max)

| Metric | desktop | mobile |
|--------|---------|--------|
| FCP | 182 → 97 → 79 ms (−56.6%) | 1,418 → 753 → 611 ms (−56.9%) |
| LCP | 182 → 186 → 151 ms (−16.7%; 141–320) | 1,418 → 753 → 611 ms (−56.9%) |
| Speed Index | 912 → 825 → 891 ms (−2.3%; 722–956) | 1,418 → 1,101 → 1,052 ms (**−25.8%**) |
| TBT | 4 → 0 → 0 | 64.5 → 24 → 22 ms |
| CLS | 0.323 → 0 → 0 (one run 0.111, the run with FCP 320) | 0.113 → 0 → 0 |

Flows, p50 / p95 (ms)

| Cell | baseline | attempt 1 | now |
|------|----------|-----------|-----|
| unthrottled open 149 panel | 44.6 / 57.8 | 45.7 / 55.3 | 38.9 / 43.6 (−12.8 / −24.6%) |
| unthrottled open 149 tiles | 72.1 / 87.1 | 75.8 / 95.9 | 61.5 / 76.4 (−14.7 / −12.3%) |
| unthrottled open 100 tiles | 88.4 / 115.3 | 69.0 / 85.1 | 56.8 / 73.2 (−35.7 / −36.5%) |
| unthrottled deep link 31 / 100 / 149 tiles | 351 / 361 / 365 | 149 / 308 / 291 | 104 / 116 / 121 (−68 to −71%) |
| same, p95 | 385 / 382 / 416 | 326 / 357 / 343 | 115 / 130 / 130 |
| fast4g deep link 31 / 100 / 149 | 1,017 / 1,027 / 1,025 | 589 / 593 / 594 | 544 / 554 / 561 |
| cpu4 deep link 31 / 100 / 149 | 1,520 / 1,561 / 1,595 | 997 / 990 / 1,027 | 787 / 827 / 913 |
| cpu4 Previous 31 / 100 / 149 | 302 / 311 / 329 | 236 / 212 / 230 | 111 / 111 / 125 (−62 to −64%) |
| unthrottled Previous 31 / 100 / 149 | 70 / 73 / 75 | 38 / 41 / 43 | 37 / 40 / 50 |
| region ALL→US unthrottled / fast4g | 73.8 / 74.8 | 64.2 / 66.1 | 64.0 / 65.7 (−13%) |
| region US→BR p95 unthrottled | 19.1 | 31.7 | 18.8 |
| cpu4 open 100 tiles | 378 | 287 | 288 (−24.0%) |
| cpu4 open 149 fetchDone / tiles | 246 / 397 | 203 / 323 | 203 / 331 |

### KPI count (192 metrics)

- **141** at −25% or better (attempt 1: 134). New: mobile SI, unthrottled open-100 tiles p50, all unthrottled deep-link cells (p50 100/149, p95 31/100/149), cpu4 Previous-31 p50/p95.
- **35** improved but short of −25% (list in the compare file; mostly the fast4g open network floor, unthrottled open-149 and region US, desktop LCP/SI, cpu4 open-149).
- **11** with a baseline of 0, **2** unchanged at known floors (`/spotify` bytesRaw; fast4g region BR p50).
- **3** worse than baseline, all by noise-sized amounts: fast4g open-149 tiles p95 (+1.3%, 233 → 236), fast4g region BR p95 (+1.6%, 18.6 → 18.9), cpu4 open-149 TBT p95 (47 → 49).
- Cells that lost −25% since attempt 1: cpu4 open-149 panel p95 (−44% → −23%) and its TBT p95 (see below).

Worse than attempt 1 by more than ~5% and 3 ms:
- cpu4 open-149 p95s (panel 71 → 98, tiles 338 → 405, TBT 14 → 49): two slow runs of 30 (tiles 405 and 450, TBT 49 and 59); the other 28 runs are at or under 359 and the p50 (331) is unchanged. Quick 8–10-run checks during the attempt gave 335–342 for this p95. Treat as outliers until a rerun says otherwise; not diagnosed.
- unthrottled Previous-149 p50/p95 43 → 50 / 50 → 66. The prefetched previous edition (156 tracks) now commits with the click, so the click frame carries the panel update and the tiles together; before, the tiles came one frame later but the click frame was lighter. Still −34% vs baseline.
- desktop SI 825 → 891 (range 722–956): desktop SI is dominated by the animated background (below), so it varies run to run.
- smaller: cpu4 Next-100 p95 83 → 88, cpu4 Next-149 p95 91 → 101, cpu4 region US p95 175 → 191, fast4g Previous-31 p95 50 → 54; p50s unchanged.

### What the traces showed

- **Attempt 1's layer hypothesis is wrong in the direction that matters.** With `forwards` fill the BR wall keeps 166 compositor layers after the entrance (`LayerTree`), and `backwards` fill drops that to 29. But then every change on the wall (the latest tile's infinite box-shadow pulse, a hover ripple, a selection) repaints all ~640 blurred glows in one layer: unthrottled open-31/100 went to ~292 ms, region ALL→US to ~270 ms, Next to 120–170 ms. Reverted; the tile rule now says why `forwards` stays. Dropping the finished animations while keeping the layers (`animation: none; will-change: transform` on animationend) cut a hand-timed ALL→US switch from 66 to 61 ms but did not move the flows cell (64.5 vs 65.2): reverted.
- **The slow first frame after a click** (~20–30 ms inside `WebFrameWidgetImpl::BeginMainFrame`, nothing traced under it even with all categories) is native code: the V8 sampler shows only `(program)` there, no JS and no GC. It appears after Playwright's move+down+up click on both the open and region flows. A `element.click()` without the move paints the panel in ~25 ms (HEAD) and a hover-then-wait click in ~33–37 ms; disabling the ripple and card (`pointer: fine` off) or all tile transitions did not change the Playwright click (39–40 ms). Cause not found.
- **Unthrottled deep links were bimodal because of a third commit.** The tiles committed one render after the wall + panel commit and landed in the expensive frames right after the wall's first paint (a 100–120 ms gap between animation frames in the slow runs). Turning off either the tiles' box-shadow or the wall frame's `backdrop-filter` (test only) removed the slow mode (0/12 slow vs 3/12), which points at raster/compositing of the first wall frames. Committing wall, panel and tiles together removed it without touching the design: p50/p95 104–121 / 115–130 ms.
- **Region switch ALL→US** is the mount of 636 animated buttons: ~30 ms in the click handler (React commit plus a forced style/layout of ~17–21 ms from the scroll check in `Wall`'s layout effect) and a ~35–40 ms frame (paint ~10 ms, the opaque native part ~20 ms). Removing the per-tile inline style (grid auto-placement plus `nth-child` rules for the stagger) and the `data-r`/`data-c` attributes changed nothing measurable (68.6 vs 68.8 ms; 69 vs 65): reverted.
- **Lighthouse desktop Speed Index is set by the animated mesh background, not the wall.** With the canvas drawn once (test build only), desktop SI was 340 ms (3 runs) against 847 with it animating, and LCP 166; mobile SI 965 vs 1,091. With the wall entrance turned off instead (test build), desktop SI did not drop (915; the headline then becomes the LCP at ~310 ms after the font swap), and mobile SI fell to 908; with every entrance animation off (wall, frame rise, headline, kicker) mobile SI was 804. So on mobile the entrance animations account for roughly 180–290 ms of SI, and on desktop the moving background accounts for ~500 ms. Both are design decisions for the user, not changes this attempt made.
- Desktop LCP is still the wall legend, painted with the wall; it moved 186 → 151 with the inlined CSS and earlier first frame. Reaching 136 needs the wall itself painted ~15–20 ms sooner.

### Experiments that failed (all reverted)

- `wall-pop` with `backwards` fill (see above): large regressions on the 636-tile walls.
- Releasing finished `wall-pop` animations on `animationend` while keeping the layers: no measurable change in the flows.
- No inline style per tile (auto-placement + 53 `nth-child` rules setting the column for the delay) and no `data-r`/`data-c`: no measurable change in region switch or open. The look was pixel-identical mid-entrance.
- Mesh canvas drawn at a quarter of the viewport and stretched (looked the same): no change in wall, deep link or open cells (A/B, 10 runs each).

### Known floors (additions)

- Desktop Speed Index while the mesh background animates from first paint: SI ≈ 720–960 ms; the 684 target needs the background to settle sooner (design decision). With a static background it is ~340.
- Region ALL→US (unthrottled/fast4g ~64–66 ms, target 55): bound by mounting 636 freshly animated buttons, which the design asks for on every switch; nothing short of a different wall rendering (fewer DOM nodes, or replaying the entrance on kept nodes) is likely to move it 15%.
- Unthrottled open-149 panel p50 (39 ms, target 33.5): one click frame with ~20 ms of untraced native work in this harness.

### Recommendations for attempt 3 (ranked)

1. **Cover art** (not started in this attempt; baseline sections 4.4 and 6): prioritise on-screen tiles over the 400 px margin, raise lookups in flight modestly, check whether Spotify's CDN serves a small variant for a ~61 px tile, cache lookups across visits. At most one default cover-plan run, stop on any 429.
2. **Open-149 and Previous-149 unthrottled**: profile the commit that renders 149–156 cover tiles (CoverTile `useCover` subscriptions, `artistColor` for every track, 149 `cover-in` layers) and make the tiles' commit cheaper; that moves open tiles (61 → 54 needed), its p95 and the Previous-149 cell that slipped.
3. **The opaque first frame after a click**: try Chrome's `--enable-features` tracing of `cc` scheduling or a perf-sampled native profile (Instruments / `perf`) on the headless renderer to name it; it costs ~20 ms on every open and region switch in this harness.
4. **Region switch**: replay the entrance on kept DOM nodes (cancel and replay the CSS animations with the Web Animations API, keyed by slot position) instead of remounting 636 buttons; only slots whose type changes (empty ↔ tile) would remount. Expected: removes most of the ~30 ms click-handler commit.
5. **Desktop LCP/SI and mobile SI**: put the background/entrance question to the user with the numbers above (e.g. hold the mesh still until the wall has drawn, or start its motion slower). Do not change it without a decision.
6. Rerun the cpu4 open-149 cell (30 runs) to confirm the p95 outliers are noise.

## Attempt 3

Measured 2026-11-10 on the same machine, as in baseline section 7 (Lighthouse 7
runs, `api.mjs` with `PERF_RESTART`, `flows.mjs --runs 30` with `PERF_RESTART`,
normal `vite build`, port 3100 checked free), then one default-plan cover run.
Full table: `scripts/perf/results/compare-attempt-3.txt` (flows
`flows-1794348387658.json`, api `api-1794345604824.json`, Lighthouse
`lighthouse/summary-1794345342672.json`); covers
`scripts/perf/results/covers-attempt-3.json`. `bun run test` 165/165 and
`bun run test:e2e` 146 passed, 1 skipped (pre-existing) before measuring.

**Measurement caveat.** The machine was much busier than in attempt 2 (load
average 36–40 during a check right after the run: other desktop apps and a VM).
Many cells the changes cannot touch (first load, wall load, region switch)
came out 5–15% worse than attempt 2. An interleaved A/B straight after the run
(attempt-2 build vs this build, 10 runs each, same conditions) found no
difference on those cells: wall drawn unthrottled 98.2 vs 102.2, cpu4 765.7 vs
737.1; region ALL→US unthrottled 56.9 vs 60.4, cpu4 155.7 vs 154.0. Treat the
"worse than attempt 2" list below as noise until it is rerun on a quiet machine.

### What changed

Client only, plus spec/design wording.

- `client/src/lib/covers.js` (cover lookups, rewritten):
  - **Order**: two IntersectionObservers, one on the viewport (tier 0) and one with the 400 px margin (tier 1); each batch is sorted top to bottom, left to right; a tile that enters the viewport later is promoted; hover and the playing track go to the front. When the edition changes, queued lookups for the old tiles are dropped. Ids already in flight are never sent twice.
  - **Concurrency** 6 → 12 in flight; a 429 halves it (minimum 2) for the rest of the visit. The 60 s retry after a failure stays.
  - **Persistence**: found covers go to `localStorage` (`su:covers:v1`), one compact line per track (`id host path day`), Spotify image-CDN URLs only, newest 2,000 kept, 30-day expiry, all access in `try`. Read in an idle callback after load (or on the first cover request), written 2 s after the last new cover and on `pagehide`. Failures are not stored.
  - **Notifications**: one subscription per track id instead of one shared `emit()` that woke every tile; changes are flushed once per frame, so a burst of answers re-renders only the affected tiles, together. A failed lookup no longer re-renders anything (unknown and none look the same).
  - **Smaller images**: oEmbed gives the 300 px album image (`ab67616d00001e02…`, ~27 kB). The CDN serves the same image id at 64 px (`ab67616d00004851…`, 2–3 kB) on all three hosts (checked on `image-cdn-ak`, `image-cdn-fa`, `i.scdn.co`; 640 px is `…b273`; `…f848` is another 300 px encoding; other codes tried 404). When tile width × devicePixelRatio ≤ ~74 (a ~61 px tile on a 1x screen; measured with a ResizeObserver, not a forced layout), the tile shows the 64 px variant. On hover or keyboard focus (the 1.7x enlargement), the 300 px image is loaded and decoded first and then swapped in, so nothing flashes. If the small one fails, the original is used. Thumbnails in any other form (e.g. older `i.scdn.co/image/<40 hex>` ids) are used as returned. At 2x every tile uses the 300 px original as before. The CSP is unchanged (same hosts).
  - **Preconnect**: pressing or resting on a wall tile (the existing intent hook) and `open()` add `<link rel=preconnect>` for `open.spotify.com` (CORS) and both image CDN hosts, at most every 8 s.
- `client/src/components/CoverGrid.jsx`: the tile's inline style sets `background` and `animation-delay` directly instead of the custom properties `--tile-g` and `--i` (the delay is left out for the playing tile, whose `animation` shorthand already resets it to 0 as before). Same look. `--tile-c` stays because the hover, focus and playing rules use it. Small-variant and sharpen-on-hover/focus logic. The `cover-loaded` mark fires only on the first load of a tile.
- `client/src/index.css`: the `.cover-tile`, `.cover-fallback` and `.cover-tile img` rules use literal easing curves and font family instead of `var(--ease-*)` / `var(--font-display)` (same values). Each tile has an inline style, so Chrome cannot reuse a matched style across tiles and resolves every `var()` per tile. Style recalc for the 149-tile frame went from 4.9–5.5 ms to 3.2–3.4 ms (traces, 3–4 each).
- `client/src/components/PlayerBar.jsx`: the bar's height (`--player-h`, inherited by every tile for `scroll-margin`) is written only when it changes and in a task after the frame the observer reported in. Before, the ResizeObserver's first report in the frame that showed the tiles set it, which forced a second style recalc of all 149 tiles inside that frame (3–3.6 ms). The 149-tile frame went from 16.5–18 ms to ~13 ms.
- `client/src/components/Archive.jsx`: calls `warmCovers()` on intent and open.
- `openspec/changes/friday-wall/specs/archive-browsing/spec.md` (Track cover art: viewport first, twelve at a time and fewer after a 429, up to 30 days in browser storage) and `design.md` section 11 (the above, including the size variants). No test change was needed: the e2e cover tests stub oEmbed with a `data:` image, which takes the as-returned path and is never stored.

### Cover art (real Spotify oEmbed, unthrottled, times from the tile click)

| Edition | Run | Tiles painted | First cover | On-screen settled | On screen | Lookups by settle | 200 / failed | Baseline settled (4.4) |
|---------|-----|---------------|-------------|-------------------|-----------|-------------------|--------------|------------------------|
| 31 | 1 | 50 | 251 | 1,459 | 31 | 31 | 31 / 0 | 1,929 |
| 31 | 2 | 66 | 249 | 1,004 | 31 | 31 | 31 / 0 | 1,300 |
| 31 | 3 | 49 | 236 | 783 | 31 | 31 | 31 / 0 | 1,228 |
| 100 | 1 | 67 | 251 | 3,131 | 96 | 100 | 98 / 0 (2 in flight) | 4,053 |
| 149 | 1 | 69 | 357 | **did not settle** (30 s timeout) | 96 | 149 | 88 / **61 failed** | 4,406 |

- 31 tracks: settle median 1,004 vs 1,300 ms (−23%), first cover 249 vs 311 (−20%). 100 tracks: 3,131 vs 4,053 (−23%), first cover 251 vs 300 (−16%). Single runs, so these are indications, not distributions.
- **No 429** in the record run or in any run of this attempt. On the 149-track edition, 61 lookups ended as network failures (`requestfailed`, not HTTP errors). Two lookups a minute later answered 200 normally. The cause is not known (the script does not log the error text). The behaviour it shows is real: when lookups fail fast, the pump sends the rest of the queue into the same failure, and those tiles keep their initials until the 60 s retry. This happened with 6 in flight too (same code path), but 12 in flight may make Spotify drop a connection more readily; it cannot be ruled out from one run.
- Iteration runs (single 31-track editions, real lookups): 4,381 ms (6 in flight, with a slow straggler), 3,068 (12), 1,528 (12, own script), 1,182 (12, final). The settle time is set by Spotify's long tail: in a 100-lookup sample the latency was p50 238 ms, p90 532, max 2,302. One slow track holds the whole screen.
- **Repeat visit** (timed by hand with a scratch Playwright script, not in the repo: covers in `localStorage` from an earlier visit, oEmbed blocked to prove no lookups, 1440x900): 100-track edition, 96 on screen: first cover 111–121 ms, all on-screen covers **171–206 ms** with the image cache cold, and 60–69 / **92–172 ms** with it warm; 31-track: 105 / 125–206 cold, 53 / 71–106 warm. **0 lookups** (baseline: 4,053 ms and 100 lookups).
- **Image bytes** (CDN transfer for one open, 1x, mocked-oEmbed script): 31-track ~77 kB, 100-track ~286 kB, against ~27 kB per cover before (~0.84 MB and ~2.7 MB). At 2x they are unchanged.
- Spotify lookups spent in this attempt: about 750 (three default-plan-sized sets: iteration runs and checks ~280, a 106-lookup hedging test from Node, the 31-track fixture, the record run 342).
- **Neighbour prefetch of covers: not done.** It would multiply lookups (two neighbours per open) for editions most visitors never open, and the persistence already makes a reopened edition free.

### Results (baseline → attempt 2 → now)

Lighthouse (median of 7)

| Metric | desktop | mobile |
|--------|---------|--------|
| FCP | 182 → 79 → 97 ms (−46.8%) | 1,418 → 611 → 612 ms (−56.9%) |
| LCP | 182 → 151 → 188 ms (**+3.1%**) | 1,418 → 611 → 612 ms (−56.9%) |
| Speed Index | 912 → 891 → 820 ms (−10.1%) | 1,418 → 1,052 → 1,011 ms (−28.7%) |
| TBT / CLS | 0 / 0 | 22 → 22 ms / 0 |

Desktop FCP/LCP moved with the machine load (no first-load code changed; the
cover module's idle callback is the only new work on load, and it does nothing
without stored covers).

Flows, p50 / p95 (ms)

| Cell | baseline | attempt 2 | now |
|------|----------|-----------|-----|
| unthrottled open 149 panel | 44.6 / 57.8 | 38.9 / 43.6 | 39.0 / 45.8 |
| unthrottled open 149 tiles | 72.1 / 87.1 | 61.5 / 76.4 | **56.9** / 73.4 (−21.1 / −15.7%) |
| unthrottled open 100 tiles | 88.4 / 115.3 | 56.8 / 73.2 | 53.8 / 67.3 |
| unthrottled Previous 31 / 100 / 149 | 70 / 73 / 75 | 37 / 40 / 50 | 40 / 41 / 44 |
| unthrottled Next 31 / 100 / 149 | 24 / 32 / 36 | 17 / 21 / 24 | 16 / 18 / 19 |
| cpu4 open 100 tiles | 378 / 549 | 288 / – | **280** / 295 (−25.9%) |
| cpu4 open 149 tiles | 397 / 423 | 331 / 405 | 321 / **337** |
| cpu4 open 149 panel p95 / TBT p95 | 128 / 47 | 98 / 49 | 86 / 0 |
| region ALL→US unthrottled / cpu4 | 73.8 / 235 | 64.0 / 154 | 61.0 / 171 |

The cpu4 open-149 p95 with 30 runs is 337 ms (tiles) and 86 ms (panel), and
TBT p95 is 0: attempt 2's 405 / 98 / 49 were outliers.

### KPI count (192 metrics)

- **140** at −25% or better (attempt 2: 141). New: cpu4 open-100 tiles p50, cpu4 open-149 panel p95 and TBT p95. Lost: cpu4 region BR p50/p95, cpu4 wall drawn p95, cpu4 Next-100 p95. Region and wall code did not change, and the A/B above shows parity.
- **37** improved but short of −25% (list in the compare file).
- **11** with a baseline of 0, and **4** at or above baseline: desktop LCP (+3.1%, see above), `/spotify` bytesRaw (floor), unthrottled region BR p50 (17.2, one frame, floor) and p95 (30.4, +59%; attempt 1 had 31.7 and attempt 2 18.8 with the same region code, so it is a few slow frames that come and go).

Worse than attempt 2 by more than 5% and 3 ms (29 cells, from diffing `compare-attempt-2.txt` and `compare-attempt-3.txt`). Almost all of them are in code this attempt did not touch: Lighthouse desktop FCP/LCP, wall load, region switches, deep links. Reported as machine noise from the A/B parity above. The ones in touched code: unthrottled open-31 p95 (66.8 → 78.2) and Previous-31 p95 (49.5 → 62.1). The p50s of those cells are unchanged (51.1, 39.6), and the A/B runs during the attempt showed open-31 p95 at 70–80 for both builds. Not confirmed as a regression; worth a quiet-machine rerun.

### Findings

- The cover wait is two things: the queue (lookups per in-flight slot) and Spotify's long tail (per-track latencies up to 1–2.3 s). More concurrency shortens the first part, but nothing on the client shortens the second except not looking the track up at all (persistence).
- **Hedging does not help.** Sending a second request for a lookup still open after 600 ms (100 lookups from Node, 6 hedged): the first request won every time, because the second was just as slow. A slow track is slow for both requests, which points to origin-side work per track, not a random slow path. Not shipped.
- Starting lookups for the first 24 tracks as soon as the edition's data arrived, instead of after the grid painted, moved the first lookup about 11 ms earlier unthrottled. At 4x CPU it cost ~20 ms on cpu4 open-31 (12 runs: 260 vs 238 without). Reverted.
- The 149-tile frame was 16.5–18 ms: style 5–5.5 ms, a second full style recalc of 3–3.6 ms triggered by `--player-h`, layout 2.4, paint ~3. Both style fixes above together brought it to ~13 ms. The React commit of 149 tiles is 5–6.5 ms including a minor GC, and it lands before the vsync, so it does not decide the number. What decides it is which frame the tiles land in.
- Measurement hazard (new): `server.sh` serves the build compressed into memory at startup, so a rebuild needs a server restart before it is measured. A scratch `deploy.sh` (stop, kill anything on 3100, build or copy a dist, start) was used for every A/B.

### Experiments that failed (all reverted)

- **Region switch: ResizeObserver flag instead of the synchronous `scrollWidth` check** in `Wall`'s layout effect (reveal deferred to the observer's report when the wall is known not to scroll). A/B, 10 runs: ALL→US unthrottled 60.5 → 64.1, cpu4 140 → 152. The forced layout only moves into the frame; it is not done twice. Reverted. The WAAPI "replay the entrance on kept nodes" idea was not tried, for time.
- Early cover lookups at data arrival (see above).
- Hedged oEmbed requests (Node test only, never in the client).

### Known floors (additions)

- Cover settle on a first visit is bounded below by the slowest on-screen track's oEmbed latency (often 1–2 s for one of 96), whatever the concurrency.
- Region ALL→US: confirmed again; the synchronous layout is the same work the frame would do.

### Recommendations for later work (ranked; attempt 3 was the last attempt)

1. **Rerun the flows on a quiet machine** before acting on any "worse than attempt 2" cell. Check `uptime` load average first (it was 36–40 here). The A/B parity says most of them are noise.
2. **Failure handling in the cover queue** (real-visitor robustness, from the 149-run's 61 failures): on a network error (fetch rejected, not an HTTP status), pause the pump for ~1–2 s, retry each failed on-screen id once, and drop to 6 in flight after two network errors in a row. Test it with a mocked oEmbed that aborts a burst and then recovers (route `open.spotify.com/oembed` in Playwright and answer from recorded thumbnails, as this attempt did for A/B work), and only then spend one 149-track real run. If failures repeat at 12 in flight, go back to 6–8.
3. **Shared server-side cover cache** (needs the user's decision; design.md section 11 rejected it once): the server, or the sync job (playlist items carry `album.images`), records `id → image id` once, so every visitor's first open needs no lookups. That gives the repeat-visit numbers (~0.2 s for 96 covers) to first visits. It is the only lever left that removes Spotify's tail.
4. **Unthrottled open-149 tiles (56.9, needs 54) and panel (39, needs 33.5)**: the tiles frame is now ~13 ms; the remaining style cost is per-tile inline styles defeating Chrome's matched-properties cache. One option: draw the fallback gradient on a child (`.cover-fallback`) and keep the button free of inline style apart from `--tile-c`. The panel number is the known ~20 ms native first frame.
5. Do not spend more on region switch or desktop LCP/SI without the background/entrance design decision.
