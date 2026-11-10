# Performance scripts

Standalone scripts behind `docs/performance-baseline.md`. They are not wired into
`package.json` or Vitest and add no dependencies: Lighthouse and autocannon run
through `bunx`, and the browser flows import Playwright from `e2e/node_modules`
(override with `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs`) and drive the
installed Google Chrome (`PERF_CHANNEL=chromium` for Playwright's own build).
Raw output lands in `scripts/perf/results/` (gitignored).

| File | What it measures |
|------|------------------|
| `server.sh` | Starts/stops a production-mode server on port 3100 (`PERF_PORT`), `SKIP_SPOTIFY_SYNC=true`, serving `client/dist`. Restarting resets the in-memory rate limiters. |
| `lighthouse.mjs` | First load of `/`: N desktop runs with no throttling and N default mobile runs (simulated slow 4G, 4x CPU). |
| `api.mjs` | Latency (sequential sample + autocannon) and payload sizes for the edition endpoints and `/spotify?page=1&size=5`. |
| `compare.mjs` | Writes the headline numbers to `docs/performance-baseline.json`, or compares the newest results with it. |
| `flows.mjs` | Browser interaction timings from the app's `su:` performance marks, per network/CPU condition. Also the opt-in `covers` (real Spotify) and `ratelimit` scenarios. |

## Rerun the baseline locally

```bash
# 1. Build the client normally (not the e2e build with the fake client id)
cd client && bunx vite build && cd ..

# 2. Start the perf server (reads .env; leaves dev servers on 3000/4200 alone)
scripts/perf/server.sh start

# 3. First load, 7 runs per preset (~4 min)
node scripts/perf/lighthouse.mjs --runs 7

# 4. API: restarts the server before each endpoint so each fits one rate-limit window (~1 min)
PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/api.mjs

# 5. Interactions: 30 fresh-context runs per scenario and condition, restarting
#    the server before each phase (~55 min)
PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/flows.mjs --runs 30

# 6. Optional, run sparingly: real Spotify cover lookups (default plan 31-track x3,
#    100 x1, 149 x1 = about 340 oEmbed lookups, unthrottled, 8 s pauses, stops on
#    the first 429) and our own 429 path (spends the local limiter with autocannon)
PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/flows.mjs --scenarios covers,ratelimit --conditions none

scripts/perf/server.sh stop
```

`flows.mjs` options: `--runs N`, `--conditions unthrottled,fast4g,fast4g-cpu4`,
`--scenarios wall,open,deeplink,region,step[,covers,ratelimit]`,
`--cover-plan small-31:3,medium-100:1,large-149:1` (runs per edition label),
`--out file.json`. Editions under test default to the three in the baseline doc;
override with `PERF_EDITIONS` (JSON array of `{label,id,region,date,tracks}`).

## Point at another server (e.g. production)

Every script takes `--base <url>` or `PERF_BASE_URL`. Against a shared server,
leave `PERF_RESTART` unset (the limiter cannot be reset), never run `ratelimit`,
and shrink the samples so one 15-minute window of 300 edition requests per
client address is enough:

```bash
PERF_BASE_URL=https://spotifyunchained.com node scripts/perf/lighthouse.mjs --runs 5
PERF_BASE_URL=https://spotifyunchained.com node scripts/perf/api.mjs --scale 0.2
PERF_BASE_URL=https://spotifyunchained.com node scripts/perf/flows.mjs --runs 5 --conditions unthrottled --scenarios wall,open
```

`api.mjs --scale 0.2` sends about 53 requests per edition endpoint and 19 to
`/spotify`; `flows.mjs --runs 5 --scenarios wall,open` sends 35 edition
requests. Your own browsing from the same address shares that budget, so check
the `RateLimit-Remaining` header first. Production numbers include real network
latency and are not comparable with the localhost baseline.

## Compare against the baseline

`docs/performance-baseline.json` holds the headline numbers. After a rerun:

```bash
node scripts/perf/compare.mjs            # newest results vs docs/performance-baseline.json
node scripts/perf/compare.mjs --flows scripts/perf/results/flows-X.json --api ... --lighthouse ...
node scripts/perf/compare.mjs --write docs/performance-baseline.json   # adopt the newest results as the baseline
```

It prints each metric's baseline value, the new value and the change in
percent. Differences inside the spread recorded in the baseline doc are noise.
