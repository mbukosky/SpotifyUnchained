# Performance baseline: Friday Wall

Measured 2026-11-10 on branch `feature/friday-wall` at commit `4ee33af`, plus the
`su:` performance marks described below (committed afterwards in `a26650a`). The
cover timings in section 4.4 are from a rerun with the CSP `img-src` fix applied. Machine-readable headline
numbers are in `docs/performance-baseline.json`; the scripts are in `scripts/perf/`.

## 1. Purpose and scope

This is the reference point for later optimisation work. It covers:

- first load of `/` (Lighthouse);
- the edition API (`/spotify/editions`, `/spotify/editions/:id`, and `/spotify?page=1&size=5` for reference);
- interactions in the browser: wall drawn, opening an edition, deep links, region switch, previous/next;
- cover art lookups against the real Spotify oEmbed endpoint (small sample);
- what our own rate limiter does to a visitor.

It does not cover production, real network paths to the server, Safari or
Firefox, touch devices, the Spotify player, or sign-in and saving playlists.

## 2. Environment and conditions

| Item | Value |
|------|-------|
| Machine | Mac16,10, Apple M4 (10 cores), 16 GB RAM |
| OS | macOS 26.6.2 (25G83) |
| Browser | Google Chrome 157.0.8103.39, headless (Lighthouse 13.6.0; Playwright 1.64.1 from `e2e/node_modules`, channel `chrome`) |
| Runtimes | Node v26.13.0 runs the server and scripts (`package.json` asks for 22.x); Bun 1.3.8; autocannon 9.0.0 |
| Database | Local dev MongoDB 5.0 in Docker on port 27017, read only |
| Server | `scripts/perf/server.sh`: `node server/index.js` with `PORT=3100 NODE_ENV=production SKIP_SPOTIFY_SYNC=true`, serving a fresh `cd client && bunx vite build` (JS 239,976 B, CSS 33,224 B) |
| Address | `http://127.0.0.1:3100` (same origin for page and API, so CORS does not apply; `trust proxy` is 1 hop, and with no proxy the limiter keys on 127.0.0.1) |
| Network | Everything is localhost with no real latency, except Google Fonts (the stylesheet and two woff2 files), which load from the internet in every run |
| Blocked | Google Analytics (`googletagmanager.com`, `google-analytics.com`) and Spotify oEmbed and embed, by request abort, in every run except the covers scenario (which leaves oEmbed open) |
| Other load | The user's dev servers (API on 3000 under `node --watch`, Vite on 4200) and a second e2e Mongo container (27018) were running on the same machine throughout |

Dataset (from `GET /spotify/editions`): 1,312 editions from 2014-07-22 to
2026-10-23. US 637, UK 136, CA 136, BR 136, MX 136, DE 131, AU none in this
database. The index response is 163,009 bytes raw. The ALL and US walls have 636
tiles; BR and UK have 136. The largest edition is UK 2025-08-22 with 243 tracks.

Editions used for interaction tests:

| Label | Id | Region, date | Tracks | Wall size in its region |
|-------|----|--------------|--------|-------------------------|
| small-31 | `54fb254277d74fdd53267270` | US 2014-12-30 (Tuesday) | 31 | 636 tiles |
| medium-100 | `6adbedd6034af47a69a6e9ff` | US 2026-10-23 | 100 | 636 tiles |
| large-149 | `6992257ccd64e387a22e1bb1` | BR 2024-08-23 | 149 | 136 tiles |

No edition in this database has exactly 30 tracks, so 31 is the nearest small one.

Browser conditions for the interaction runs (viewport 1440x900, device scale 1):

| Name | Settings |
|------|----------|
| unthrottled | none |
| fast4g | CDP `Network.emulateNetworkConditions`: latency 165 ms, download 1,012,500 B/s, upload 168,750 B/s (Chrome DevTools "Fast 4G" values). Applies to localhost too. |
| fast4g-cpu4 | fast4g plus `Emulation.setCPUThrottlingRate` 4 |

## 3. Method

### 3.1 First load: `scripts/perf/lighthouse.mjs`

`bunx lighthouse` 7 times per preset against `/`, performance category only,
headless Chrome, each run a fresh profile:

- **desktop-unthrottled**: `--preset=desktop --throttling-method=provided`, so no throttling is applied at all;
- **mobile**: Lighthouse defaults, simulated throttling (RTT 150 ms, 1.6 Mbps, 4x CPU), 412x823 screen.

Reported as median and min–max of 7. Transfer sizes come from the `network-requests` audit
(transfer = bytes on the wire including headers; raw = decoded body).

### 3.2 API: `scripts/perf/api.mjs`

For each endpoint, after restarting the perf server so the limiter starts empty:

1. one request with `Accept-Encoding: gzip, deflate, br` and one with `identity`, for sizes and headers;
2. 60 sequential requests (30 for `/spotify`) timed in Node from request to last byte, giving exact p50/p95/p99;
3. `bunx autocannon -c 1 -a 200` (60 for `/spotify`), same `Accept-Encoding`; autocannon reports p50, p90, p97.5 and p99 but not p95;
4. one more request to read `RateLimit-Remaining`.

That is 264 requests per edition endpoint against a limit of 300, and 94 against
the 100 limit for `/spotify`. `RateLimit-Remaining` was 37 (editions) and 7
(`/spotify`) at the end; no request was rejected. With one connection the
latency is per request, not under concurrent load.

### 3.3 Interactions: `scripts/perf/flows.mjs`

Each run is a new browser context (empty cache and storage) in one headless
Chrome per phase; 30 runs per scenario, edition and condition. The server is
restarted before every phase (`PERF_RESTART`) so the rate limiter never
interferes; the largest phase (step) sends 90 edition requests. Times are in
milliseconds from navigation start (page loads) or from the `click` event's
`timeStamp` (interactions), read from the `su:` marks below with
`performance.now()` as the clock. Long tasks come from a `longtask`
PerformanceObserver installed before the app; TBT here is the sum of
(duration − 50 ms) for long tasks that start inside the measured interval.
Percentiles are nearest-rank over 30 values.

Scenarios:

- **wall**: load `/` (region ALL); FCP, `su:index-loaded`, `su:wall-drawn`, and when every `wall-pop` animation has finished.
- **open**: load `/` with the edition's region saved, wait for the wall to settle, click the edition's tile. Measures panel painted (`su:panel-open`), data in hand (`su:edition-loaded`), tiles painted (`su:tracks-rendered`), all `cover-in` animations finished, the edition request's Resource Timing, and long tasks from click to tiles painted. The script checks that the URL holds the expected id and that the tile count matches.
- **deeplink**: cold load of `/?edition=<id>`, all times from navigation start.
- **region**: load `/` on ALL, click US, then BR; click to `su:wall-drawn` for the new region, animations finished, and requests to our origin during each switch.
- **step**: deep link to the edition, then Previous (an uncached edition) and Next (back to the cached one).
- **covers** (opt-in): real oEmbed lookups, unthrottled only, 8 s pause between runs, stop on the first 429.
- **ratelimit** (opt-in, local only): spend 299 of the 300 edition requests with autocannon, load the page, open an edition, reload.

### 3.4 Performance marks added to the client

All go through `client/src/lib/perf.js`, which calls `performance.mark` inside
a `try` and does nothing when `performance` is missing. "After paint" marks
are queued with `requestAnimationFrame` then `setTimeout(0)`, so they land
after the frame containing the change. No mark changes state or rendering.

| Mark | Where | When | `detail` |
|------|-------|------|----------|
| `su:index-loaded` | `hooks/useEditions.js` | the index JSON is parsed | number of editions |
| `su:wall-drawn` | `components/Wall.jsx` | after paint, when the wall's rows or region change | `{ region, tiles }` |
| `su:panel-open` | `components/EditionPanel.jsx` | after paint, when the panel shows a new edition id (heading visible) | edition id |
| `su:edition-loaded` | `components/EditionPanel.jsx` | the edition data resolves (network or page cache) | edition id |
| `su:tracks-rendered` | `components/CoverGrid.jsx` | after paint, when the grid's tracks change | number of tracks |
| `su:cover-loaded` | `components/CoverGrid.jsx` | a cover image fires `load` | track id |

After adding them: `bun run test` passed 155 of 155, and `cd client && bunx vite build` succeeded.

## 4. Results

### 4.1 First load (Lighthouse, 7 runs each, median and min–max)

| Metric | desktop-unthrottled | mobile (simulated slow 4G, 4x CPU) |
|--------|--------------------|------------------------------------|
| Performance score | 84 (83–84) | 96 (96–96) |
| First Contentful Paint | 182 ms (172–185) | 1,418 ms (1,416–1,431) |
| Largest Contentful Paint | 182 ms (172–185) | 1,418 ms (1,416–1,431) |
| Total Blocking Time | 4 ms (0–16) | 65 ms (55–77) |
| Cumulative Layout Shift | 0.323 (0.322–0.323) | 0.113 (0.110–0.113) |
| Speed Index | 912 ms (814–1,001) | 1,418 ms (1,416–1,431) |
| Time to Interactive | 255 ms (221–284) | 2,119 ms (2,100–2,136) |
| Main-thread work | 1,887 ms (1,812–2,138) | 3,078 ms (2,879–3,224) |
| JS execution (bootup) | 120 ms (110–140) | 268 ms (249–278) |
| Total transfer | 197,877 B | 197,878 B |

LCP equals FCP in every run: the LCP element is the footer paragraph ("Not an
official Spotify application"), because the wall's tiles are buttons with no
text or image. Layout shifts come from one element per preset: `main.archive`
(score 0.322) on desktop and `footer.site-footer` (0.113) on mobile, with a
0.001 shift of the region buttons on desktop when the web fonts arrive.
Lighthouse's render-blocking insight on mobile names the Google Fonts
stylesheet (its estimate: 824 ms) and our CSS (153 ms).

Transfer by type (first desktop run; mobile differs only in font bytes):

| Resource | Requests | Transfer | Raw |
|----------|---------|----------|-----|
| HTML | 1 | 2,532 B | 3,622 B |
| JS (app bundle) | 1 | 77,009 B | 239,976 B |
| CSS (app) | 1 | 9,945 B | 33,224 B |
| Google Fonts CSS | 1 | 1,236 B | 10,904 B |
| Font files (woff2) | 2 | 84,630 B | 84,564 B |
| `/spotify/editions` index | 1 | 19,907 B | 163,009 B |
| Other (favicon, inline SVG) | 2 | 1,987 B | 1,541 B |

Lighthouse flags 35,485 B of the 75,582 B compressed bundle as unused during the
load of `/` (the edition panel and player code is not run until a tile is opened).

An exploratory first pass, before Google Analytics was blocked (and with the
simulated desktop preset), recorded `gtag/js` at 165,920 B transfer
(478,712 B raw), more than twice the app bundle, and a mobile TBT of
99–153 ms across 5 runs against 55–77 ms with it blocked. Those report files
were not kept; the numbers are from that run's console output.

### 4.2 API (localhost, one connection)

All responses are compressed by the `compression` middleware; with
`br` offered they come back as Brotli. Sequential sample of 60 (30 for `/spotify`):

| Endpoint | Raw | Compressed (br) | p50 | p95 | p99 | max |
|----------|-----|-----------------|-----|-----|-----|-----|
| `GET /spotify/editions` (1,312 items) | 163,009 B | 18,412 B | 14.3 ms | 18.0 ms | 18.3 ms | 18.3 ms |
| `/spotify/editions/:id` 31 tracks | 7,262 B | 1,720 B | 1.6 ms | 3.6 ms | 8.1 ms | 8.1 ms |
| `/spotify/editions/:id` 100 tracks | 23,093 B | 5,093 B | 2.6 ms | 4.4 ms | 5.4 ms | 5.4 ms |
| `/spotify/editions/:id` 149 tracks | 34,682 B | 7,465 B | 2.8 ms | 6.1 ms | 11.5 ms | 11.5 ms |
| `/spotify/editions/:id` 243 tracks (largest) | 55,505 B | 11,537 B | 3.0 ms | 6.6 ms | 9.1 ms | 9.1 ms |
| `GET /spotify?page=1&size=5` | 69,037 B | 11,286 B | 5.6 ms | 9.0 ms | 9.8 ms | 9.8 ms |

autocannon (`-c 1`, 200 requests; 60 for `/spotify`; whole milliseconds; 0 errors, 0 non-2xx):

| Endpoint | p50 | p90 | p97.5 | p99 | max |
|----------|-----|-----|-------|-----|-----|
| index | 13 | 17 | 21 | 25 | 46 |
| 31 tracks | 1 | 2 | 4 | 5 | 5 |
| 100 tracks | 1 | 2 | 4 | 5 | 7 |
| 149 tracks | 1 | 2 | 3 | 3 | 7 |
| 243 tracks | 2 | 4 | 6 | 6 | 11 |
| `/spotify?page=1&size=5` | 5 | 6 | 9 | 9 | 9 |

Headers: the index sends `Cache-Control: public, max-age=300`, editions
`public, max-age=3600`; both send `RateLimit-Policy: 300;w=900`,
`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (draft-6 style,
no legacy `X-RateLimit-*`). `/spotify` sends `RateLimit-Policy: 100;w=900`.

### 4.3 Interactions (30 runs each; p50 / p95 in ms, min–max in brackets)

**Wall load (`/`, region ALL, 636 tiles), from navigation start**

| Metric | unthrottled | fast4g | fast4g-cpu4 |
|--------|-------------|--------|-------------|
| FCP | 148 / 1,132 (124–2,264) | 500 / 508 (484–516) | 576 / 596 (564–600) |
| index parsed (`su:index-loaded`) | 164 / 1,152 (129–2,286) | 668 / 685 (656–688) | 765 / 779 (714–782) |
| wall drawn and painted | 245 / 1,239 (189–2,364) | 735 / 754 (723–758) | 1,047 / 1,082 (981–1,094) |
| wall entrance animation finished | 1,826 / 2,834 (1,774–3,942) | 2,324 / 2,344 (2,306–2,347) | 2,614 / 2,644 (2,542–2,669) |
| index request duration (Resource Timing) | 38 / 73 (19–82) | 197 / 199 (191–200) | 197 / 202 (187–202) |
| TBT up to wall drawn | 3 / 36 (0–38) | 4 / 8 (0–9) | 154 / 172 (146–180) |

Unthrottled, 26 of 30 runs had FCP between 124 and 256 ms and 4 had 816, 880,
1,132 and 2,264 ms; those four set the p95. From index parsed to wall painted
took a median of 77 ms unthrottled and 287 ms at 4x CPU.

**Open an edition by clicking its tile, from the click**

| Edition | Metric | unthrottled | fast4g | fast4g-cpu4 |
|---------|--------|-------------|--------|-------------|
| 31 (US wall) | panel heading painted | 72 / 102 (67–119) | 65 / 77 (59–77) | 193 / 203 (181–204) |
| | data in hand | 73 / 102 (67–119) | 218 / 224 (211–228) | 338 / 347 (328–348) |
| | **tiles painted** | **99 / 136 (87–144)** | **235 / 238 (234–252)** | **386 / 401 (375–423)** |
| | tile animation finished | 697 / 725 | 846 / 863 | 969 / 985 |
| | edition request duration | 10 / 20 | 180 / 182 | 183 / 186 |
| | TBT click → tiles | 0 / 3 | 0 / 0 | 101 / 111 |
| 100 (US wall) | panel heading painted | 64 / 80 (51–90) | 55 / 60 (45–61) | 150 / 354 (132–388) |
| | data in hand | 64 / 81 (51–91) | 207 / 213 (203–213) | 287 / 455 (279–474) |
| | **tiles painted** | **88 / 115 (77–145)** | **226 / 238 (223–238)** | **378 / 549 (356–674)** |
| | tile animation finished | 894 / 911 | 1,030 / 1,045 | 1,136 / 1,318 |
| | edition request duration | 12 / 30 | 184 / 187 | 191 / 204 |
| | TBT click → tiles | 0 / 0 | 0 / 0 | 55 / 247 |
| 149 (BR wall) | panel heading painted | 45 / 58 (36–103) | 43 / 55 (36–56) | 104 / 128 (95–139) |
| | data in hand | 45 / 58 (37–279) | 201 / 203 (196–204) | 246 / 264 (237–319) |
| | **tiles painted** | **72 / 87 (59–320)** | **228 / 233 (226–235)** | **397 / 423 (373–473)** |
| | tile animation finished | 1,027 / 1,032 | 1,180 / 1,197 | 1,244 / 1,276 |
| | edition request duration | 8 / 14 | 183 / 186 | 182 / 185 |
| | TBT click → tiles | 0 / 0 | 0 / 0 | 35 / 47 |

All 149 tiles enter the DOM in a single React commit; "tiles painted" is the
frame after it. On the 149-track edition, the first tile entered the DOM a
median of 62 ms (unthrottled), 204 ms (fast4g) and 259 ms (fast4g-cpu4) after the
click. That observer was installed just after the click in this run, so it
missed the commit in most runs of the two smaller editions; the script now
installs it before the click (a 3-run check gave 31: 87, 100: 58, 149: 52 ms
p50 unthrottled), and the number is not part of the baseline.

The "animation finished" rows follow the stagger built into the CSS: each tile
waits `min(index, 160) × 3 ms`, then animates for 500 ms. The measured gap
between tiles painted and animation finished (598, 806 and 955 ms) matches
that design, so it is not a rendering cost.

**Deep link `/?edition=<id>`, cold, from navigation start**

| Edition | Metric | unthrottled | fast4g | fast4g-cpu4 |
|---------|--------|-------------|--------|-------------|
| 31 | wall painted | 233 / 261 | 774 / 793 | 1,212 / 1,970 |
| | data in hand | 258 / 285 | 964 / 984 | 1,428 / 2,204 |
| | **tiles painted** | **351 / 385 (336–387)** | **1,017 / 1,036 (973–1,036)** | **1,520 / 2,287 (1,416–2,786)** |
| | TBT to tiles | 0 / 0 | 4 / 8 | 255 / 280 |
| 100 | wall painted | 223 / 261 | 755 / 1,135 | 1,221 / 1,809 |
| | data in hand | 261 / 288 | 964 / 1,346 | 1,450 / 1,990 |
| | **tiles painted** | **361 / 382 (269–389)** | **1,027 / 1,407 (971–2,897)** | **1,561 / 2,103 (1,443–3,461)** |
| | TBT to tiles | 0 / 0 | 2 / 7 | 208 / 256 |
| 149 | wall painted | 244 / 293 | 773 / 805 | 1,220 / 1,363 |
| | data in hand | 266 / 320 | 971 / 1,005 | 1,452 / 1,594 |
| | **tiles painted** | **365 / 416 (282–437)** | **1,025 / 1,043 (997–1,078)** | **1,595 / 1,745 (1,476–4,482)** |
| | TBT to tiles | 0 / 3 | 3 / 6 | 263 / 299 |

The edition request starts only after the index has loaded and the wall has
rendered (the panel mounts once the index is known), so on fast4g the data
arrives about 190 ms (one request) after the wall is painted.

**Region switch (ALL → US → BR), from the click**

| Step | Metric | unthrottled | fast4g | fast4g-cpu4 |
|------|--------|-------------|--------|-------------|
| ALL → US (636 → 636 tiles) | wall painted | 74 / 90 (65–98) | 75 / 82 (68–83) | 235 / 258 (226–261) |
| | TBT | 0 / 0 | 0 / 0 | 117 / 136 |
| | requests to our origin | 0 | 0 | 0 |
| US → BR (636 → 136 tiles) | wall painted | 17 / 19 (14–19) | 17 / 19 (15–19) | 61 / 69 (55–69) |
| | TBT | 0 / 0 | 0 / 0 | 0 / 1 |
| | requests to our origin | 0 | 0 | 0 |

No request is made on a region switch (verified in all 180 switches). The
entrance animation replays each time: finished 1,663 ms (US) and 1,062 ms (BR)
after the click, unthrottled.

**Previous / next, from the click**

| Edition | Step | unthrottled | fast4g | fast4g-cpu4 |
|---------|------|-------------|--------|-------------|
| 31 | Previous (uncached), tiles painted | 70 / 87 | 218 / 221 | 302 / 330 |
| | Next (back, cached), tiles painted | 24 / 39 | 25 / 32 | 101 / 115 |
| 100 | Previous (uncached) | 73 / 91 | 222 / 237 | 311 / 358 |
| | Next (cached) | 32 / 35 | 31 / 36 | 110 / 124 |
| 149 | Previous (uncached) | 75 / 94 | 226 / 231 | 329 / 346 |
| | Next (cached) | 36 / 38 | 35 / 39 | 125 / 139 |

Previous sent exactly one edition request every time and Next none (the page
cache serves it). Both also re-requested `/favicon.svg` on every step (Chrome
does this when `history.replaceState` changes the URL); it is a static file
and does not count against the limiter.

### 4.4 Cover art (real Spotify oEmbed, unthrottled)

These numbers come from a rerun after a CSP fix, not from the main run at
`4ee33af`. The first cover run found that Spotify returns most `thumbnail_url`
values on `image-cdn-fa.spotifycdn.com` and `image-cdn-ak.spotifycdn.com`,
while `img-src` allowed only `https://i.scdn.co` among Spotify hosts. Chrome
blocked 29 of 31, 100 of 100 and 149 of 149 cover images, so nothing settled.
`img-src` now also allows `https://*.spotifycdn.com`, and the scenario was run
again on a fresh production build with that change (5 runs: 31 tracks ×3,
100 ×1, 149 ×1; 8 s between runs). Times are from the tile click.

| Edition | Run | Tiles painted | First cover | All tiles in viewport show a cover | Tiles in viewport | Lookups issued by then | Covers loaded by then |
|---------|-----|---------------|-------------|------------------------------------|-------------------|------------------------|-----------------------|
| 31 | 1 | 111 ms | 311 ms | 1,929 ms | 31 | 31 | 31 |
| 31 | 2 | 306 ms | 505 ms | 1,300 ms | 31 | 31 | 31 |
| 31 | 3 | 100 ms | 275 ms | 1,228 ms | 31 | 31 | 31 |
| 100 | 1 | 104 ms | 300 ms | 4,053 ms | 96 | 100 | 100 |
| 149 | 1 | 78 ms | 390 ms | 4,406 ms | 96 | 119 | 112 |

- The first cover appears about 200–310 ms after the tiles are painted.
- Settle time grows with the number of tiles on screen: about 1.2–1.9 s for 31 and 4.1–4.4 s for 96. That is roughly 40–60 ms per cover with six lookups in flight, so the lookup queue, not rendering, sets the pace.
- With 61 px tiles at 1440x900, every tile of all three editions lies within the 400 px IntersectionObserver margin, so every track is looked up on open and scrolling to the end adds no lookups (also confirmed with oEmbed aborted: 31, 100 and 149 attempts on open). On the 149-track edition the 96 on-screen tiles settled while 30 off-screen lookups were still queued.
- The sample is small on purpose, to keep real lookups in the low hundreds. One run per large edition gives a single value, not a distribution.

Spotify: every oEmbed response seen in this rerun was a 200 and there was no
429. Over the whole job that is about 720 lookups (376 in the first pass,
about 340 in the rerun) with no refusal.

### 4.5 Rate limiting (our own limiter)

- Budget: 300 requests per 15 minutes per client address, shared by the index and edition endpoints. A first page load uses 1 (the index; editions are cached in memory for the life of the page), so a visitor gets **299 edition opens per 15-minute window**. Previous to an unopened edition costs 1, returning to one already opened costs 0 (measured above); a lucky dip costs 1 per pick. Each reload or new tab costs 1 more for the index, unless the browser reuses its cached copy (`max-age=300`); that cache behaviour was not measured.
- Headers on the last allowed request: `RateLimit-Remaining: 0`, `RateLimit-Reset: 899`. The next edition request returned 429 with `Retry-After: 898` (the limiter is configured to answer `{"error":"Too many requests, please try again later."}`; the body was not captured).
- UI, verified once on the perf server (autocannon spent 299, the page load spent the last one): the panel opens with the heading, date and track count, and shows **"Failed to load this edition. Please try again."** in place of the tiles (screenshot `scripts/perf/results/ratelimit-panel.png`). It is the same message as any other failure; there is no retry control and the wait time is not shown. From the code (not exercised in the run), clicking the same tile again does not refetch, because the panel only loads on a change of edition id. After a reload the whole wall is replaced by **"Failed to load playlists. Please try again."** until the window resets (screenshot `ratelimit-wall.png`).

## 5. Known limits of this baseline

- Local only. The server, database and browser share one machine, with no real network between them; the API numbers are server time plus loopback. Production adds real latency, TLS and Railway's proxy, so absolute numbers will differ; compare like with like.
- The emulated conditions apply fixed latency to every request, including localhost. They are a model of a slower client, not a measurement of one.
- Google Fonts came from the internet in every run, which is the likely source of the four slow unthrottled wall loads; not proven, because font timing was not recorded per run.
- Google Analytics was blocked throughout, so the numbers exclude its 166 kB script.
- The dev servers and an e2e Mongo container were running on the machine during all runs.
- Headless Chrome at 1440x900 with a fine pointer. Phones, touch, and other browsers are not covered.
- Samples: 7 Lighthouse runs per preset; 30 runs per interaction cell (p95 is the 29th value of 30, so a single slow run moves it); 5 cover runs only.
- The cover timings (section 4.4) come from a rerun after the CSP fix: 5 runs, with one run each for the 100- and 149-track editions.
- The local database has no AU editions and no 30-track edition.
- Node 26 ran the server; production specifies Node 22.

## 6. Most promising improvements, ranked by evidence

1. **Cover settle time.** On-screen covers take 4.1–4.4 s to fill in for 96 tiles, against about 0.1 s for the tiles themselves, and every track is looked up on open because the whole grid sits inside the 400 px lazy-load margin (section 4.4). Candidates the numbers point at: a tighter margin so off-screen tiles wait, and more than six lookups in flight. (The first pass of this baseline found the covers blocked outright by `img-src`; that was fixed before the rerun.)
2. **Start the deep-link edition request alongside the index.** On deep links the edition request waits for the index and the wall: data arrives about 190 ms after the wall on fast4g (964 vs 774 ms for 31 tracks) and about 216 ms after it at 4x CPU, and the request alone takes 180–190 ms on fast4g. Running the two requests in parallel can save up to about one request's time on deep links (p50 tiles painted now 1,017–1,027 ms on fast4g).
3. **Layout shift on first load.** CLS is 0.323 on desktop (`main.archive`) and 0.113 on mobile (the footer), both above the 0.1 "good" line; it is the main reason the desktop score is 84 while every timing metric is fast. The shifted elements are the ones below the loading spinner, which suggests the content arriving after the index loads moves them; reserving its space is the obvious candidate.
4. **Opening an edition re-renders the whole wall.** Click to panel painted scales with the size of the wall, not the edition: at 4x CPU it is 193 and 150 ms on the US wall (636 tiles) against 104 ms on the BR wall (136 tiles), with click-to-tiles TBT of 101 and 55 ms (US) against 35 ms (BR). The same pattern shows in region switches (ALL → US 235 ms and 117 ms TBT; US → BR 61 ms and 0). Unthrottled, the panel takes 45–72 ms to paint while the edition request itself takes 8–12 ms, and the request only starts after that first render.
5. **Render-blocking Google Fonts stylesheet.** It is on the critical path of every first paint: mobile FCP is 1,418 ms, Lighthouse estimates 824 ms of it is spent blocked on the fonts stylesheet, and the four unthrottled wall loads with FCP of 816–2,264 ms (against a 148 ms median) all loaded it from the internet.
6. **Wall render cost at 4x CPU.** From index parsed to wall painted: 287 ms p50 at 4x CPU (77 ms unthrottled), TBT 154 ms on load. The first frame of 636 animated buttons is the single largest block of main-thread work on load.
7. **Google Analytics weight.** In the exploratory run `gtag/js` was 165,920 B on the wire, more than twice the app bundle, and mobile TBT was 99–153 ms with it against 55–77 ms without. Deferring it would cut both; the comparison comes from one exploratory pass, so re-measure before acting.

Not worth chasing on these numbers: API latency (edition endpoints p95 under
7 ms, index 18 ms, all compressed; 7–12 kB per edition on the wire), and the
"animation finished" times, which follow the stagger designed into the CSS.

## 7. How to rerun and compare

Full commands are in `scripts/perf/README.md`. In short:

```bash
cd client && bunx vite build && cd ..
scripts/perf/server.sh start
node scripts/perf/lighthouse.mjs --runs 7
PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/api.mjs
PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/flows.mjs --runs 30   # about 55 minutes
scripts/perf/server.sh stop
node scripts/perf/compare.mjs     # newest results against docs/performance-baseline.json
```

`compare.mjs` prints each of the 192 headline metrics with its baseline value,
the new value and the change. Treat a change as real only when it is outside
the min–max spread given here for that cell, and rerun on the same machine
with the same background load. Every script takes `--base <url>` or
`PERF_BASE_URL` to point at another server; the README gives reduced sample
sizes that fit one rate-limit window when the limiter cannot be reset.

Raw results for this baseline, in `scripts/perf/results/` (gitignored):
`lighthouse/summary-1794312884862.json` and its 14 reports,
`api-1794313170819.json`, `flows-baseline.json`,
`flows-covers-ratelimit.json`, `covers-after-csp.json` (the section 4.4 rerun),
and the two rate-limit screenshots.
