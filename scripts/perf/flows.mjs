#!/usr/bin/env node
// Interaction timings for the Friday Wall, measured in fresh browser contexts
// with the app's `su:` performance marks. See scripts/perf/README.md.
//
//   node scripts/perf/flows.mjs [--runs 20] [--conditions unthrottled,fast4g,fast4g-cpu4]
//                               [--scenarios wall,open,deeplink,region,step] [--base URL]
//
// The `covers` (real cover images from Spotify's CDN) and `ratelimit` (exhausts the
// local limiter) scenarios only run when named explicitly; every other scenario answers cover images locally and aborts the embed and Google
// Analytics. PERF_RESTART (a shell command) runs before each phase so a local
// server's rate limiter starts fresh; leave it unset against production.
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.PERF_BASE_URL || 'http://127.0.0.1:3100' },
    runs: { type: 'string', default: process.env.PERF_RUNS || '20' },
    conditions: { type: 'string', default: 'unthrottled,fast4g,fast4g-cpu4' },
    scenarios: { type: 'string', default: 'wall,open,deeplink,region,step' },
    // Real lookups per edition: at 1440x900 every tile is inside the 400px
    // observer margin, so one open looks up every track of the edition.
    'cover-plan': { type: 'string', default: 'small-31:3,medium-100:1,large-149:1' },
    out: { type: 'string', default: '' },
  },
});
const BASE = args.base.replace(/\/$/, '');
const RUNS = Number(args.runs);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || new URL('../../e2e/node_modules/playwright/index.mjs', import.meta.url).href);

// Editions under test; override with PERF_EDITIONS='[{"label":..,"id":..,"region":..,"date":..,"tracks":..}]'.
const EDITIONS = JSON.parse(process.env.PERF_EDITIONS || JSON.stringify([
  { label: 'small-31', id: '54fb254277d74fdd53267270', region: 'US', date: '2014-12-30', tracks: 31 },
  { label: 'medium-100', id: '6adbedd6034af47a69a6e9ff', region: 'US', date: '2026-10-23', tracks: 100 },
  { label: 'large-149', id: '6992257ccd64e387a22e1bb1', region: 'BR', date: '2024-08-23', tracks: 149 },
]));
// Chrome DevTools "Fast 4G" preset values; CPU slowdown via CDP.
const CONDITIONS = {
  unthrottled: null,
  fast4g: { latency: 165, downloadThroughput: 1_012_500, uploadThroughput: 168_750, cpu: 1 },
  'fast4g-cpu4': { latency: 165, downloadThroughput: 1_012_500, uploadThroughput: 168_750, cpu: 4 },
};
const BLOCK = /open\.spotify\.com\/(oembed|embed)|googletagmanager\.com|google-analytics\.com/;
// Cover images are answered locally with a one-pixel PNG, so runs do not
// depend on Spotify's CDN. Aborting them instead would send every tile down
// its image-error path (a re-render and a second request), which no visitor sees.
const COVER_IMAGES = /\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/image\//;
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const BLOCK_GA = /googletagmanager\.com|google-analytics\.com/;
const VIEWPORT = { width: 1440, height: 900 };

function weekKey(s) { // mirrors client/src/lib/wall.js isoWeek/weekKey
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Runs in the page before any app code.
const INIT = () => {
  window.__su = { clicks: [], longtasks: [], lcp: 0 };
  addEventListener('click', e => window.__su.clicks.push(e.timeStamp), true);
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__su.longtasks.push([e.startTime, e.duration]); })
      .observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__su.lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }
};

async function newPage(browser, cond, { region, blockCovers = true } = {}) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await page.route(blockCovers ? BLOCK : BLOCK_GA, r => r.abort());
  if (blockCovers) await page.route(COVER_IMAGES, r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  await page.addInitScript(INIT);
  if (region) await page.addInitScript(r => localStorage.setItem('selectedRegion', r), region);
  if (cond) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...cond, cpu: undefined });
    if (cond.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cond.cpu });
  }
  const requests = [];
  page.on('request', r => { if (r.url().startsWith(BASE)) requests.push(new URL(r.url()).pathname); });
  return { ctx, page, requests };
}

// Wait for a `su:` mark (optionally with matching detail) after `since`; return its time.
const waitMark = (page, name, { detail, since = 0, timeout = 30_000 } = {}) => page.waitForFunction(
  ({ name, detail, since }) => {
    const m = performance.getEntriesByName(`su:${name}`).find(e => e.startTime >= since
      && (detail === undefined || JSON.stringify(e.detail) === JSON.stringify(detail)
        || (detail?.region && e.detail?.region === detail.region)));
    return m ? m.startTime : false;
  }, { name, detail, since }, { timeout, polling: 'raf' }).then(h => h.jsonValue());

// Time when all running CSS animations with this name have finished.
const animationsDone = (page, name) => page.evaluate(n => Promise.all(document.getAnimations()
  .filter(a => a.animationName === n).map(a => a.finished.catch(() => null))).then(() => performance.now()), name);

const longTaskStats = (page, from, to) => page.evaluate(([from, to]) => {
  const ts = window.__su.longtasks.filter(([s]) => s >= from && s <= to);
  return { count: ts.length, total: ts.reduce((a, [, d]) => a + d, 0), tbt: ts.reduce((a, [, d]) => a + Math.max(0, d - 50), 0) };
}, [from, to]);

const resource = (page, suffix) => page.evaluate(sfx => {
  const e = performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname === sfx).at(-1);
  return e && { duration: e.duration, ttfb: e.responseStart - e.startTime, transfer: e.transferSize, encoded: e.encodedBodySize, decoded: e.decodedBodySize };
}, suffix);

const lastClick = page => page.evaluate(() => window.__su.clicks.at(-1));

async function openTile(page, ed) {
  // Watch for the first cover tile entering the DOM (the commit, before paint).
  await page.evaluate(() => {
    window.__suDom = null;
    const mo = new MutationObserver(() => {
      if (document.querySelector('.cover-tile')) { window.__suDom = performance.now(); mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
  await page.locator(`.wall-tile[data-key="${weekKey(ed.date)}"]`).click();
  return lastClick(page);
}

// Click → panel → tiles for one edition, from a click already made at t0.
async function measureOpen(page, ed, t0) {
  const panel = await waitMark(page, 'panel-open', { detail: ed.id, since: t0 });
  const loaded = await waitMark(page, 'edition-loaded', { detail: ed.id, since: t0 });
  const painted = await waitMark(page, 'tracks-rendered', { detail: ed.tracks, since: loaded });
  const dom = await page.evaluate(() => window.__suDom);
  const settled = await animationsDone(page, 'cover-in');
  const count = await page.locator('.cover-tile').count();
  if (count !== ed.tracks) throw new Error(`expected ${ed.tracks} tiles, saw ${count}`);
  const url = new URL(page.url()).searchParams.get('edition');
  if (url !== ed.id) throw new Error(`opened ${url}, expected ${ed.id}`);
  return {
    panelPainted: panel - t0, fetchDone: loaded - t0, tilesInDom: dom ? dom - t0 : null,
    tilesPainted: painted - t0, tilesSettled: settled - t0,
    fetch: await resource(page, `/spotify/editions/${ed.id}`),
    longTasks: await longTaskStats(page, t0, painted),
  };
}

async function loadWall(page, url) {
  await page.goto(url);
  const drawn = await waitMark(page, 'wall-drawn');
  const settled = await animationsDone(page, 'wall-pop');
  const m = await page.evaluate(() => ({
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    lcp: window.__su.lcp || null,
    index: performance.getEntriesByName('su:index-loaded')[0]?.startTime ?? null,
    tiles: document.querySelectorAll('.wall-tile').length,
  }));
  return { ...m, wallDrawn: drawn, wallSettled: settled, indexFetch: await resource(page, '/spotify/editions'), longTasks: await longTaskStats(page, 0, drawn) };
}

const SCENARIOS = {
  async wall(browser, cond) {
    const { ctx, page } = await newPage(browser, cond);
    try { return await loadWall(page, `${BASE}/`); } finally { await ctx.close(); }
  },
  async open(browser, cond, ed) {
    const { ctx, page } = await newPage(browser, cond, { region: ed.region });
    try {
      await loadWall(page, `${BASE}/`);
      return await measureOpen(page, ed, await openTile(page, ed));
    } finally { await ctx.close(); }
  },
  async deeplink(browser, cond, ed) {
    const { ctx, page } = await newPage(browser, cond);
    try {
      await page.goto(`${BASE}/?edition=${ed.id}`);
      const painted = await waitMark(page, 'tracks-rendered', { detail: ed.tracks });
      const r = await page.evaluate(() => ({
        wallDrawn: performance.getEntriesByName('su:wall-drawn')[0]?.startTime,
        panelPainted: performance.getEntriesByName('su:panel-open')[0]?.startTime,
        fetchDone: performance.getEntriesByName('su:edition-loaded')[0]?.startTime,
      }));
      return { ...r, tilesPainted: painted, tilesSettled: await animationsDone(page, 'cover-in'), longTasks: await longTaskStats(page, 0, painted) };
    } finally { await ctx.close(); }
  },
  async region(browser, cond) {
    const { ctx, page, requests } = await newPage(browser, cond, { region: 'ALL' });
    try {
      await loadWall(page, `${BASE}/`);
      const out = {};
      for (const r of ['US', 'BR']) {
        const before = requests.length;
        await page.locator('.region-btn', { hasText: new RegExp(`^${r}$`) }).click();
        const t0 = await lastClick(page);
        const drawn = await waitMark(page, 'wall-drawn', { detail: { region: r }, since: t0 });
        const settled = await animationsDone(page, 'wall-pop');
        out[r] = { wallDrawn: drawn - t0, wallSettled: settled - t0, requests: requests.length - before, paths: requests.slice(before), longTasks: await longTaskStats(page, t0, drawn) };
      }
      return out;
    } finally { await ctx.close(); }
  },
  async step(browser, cond, ed) {
    const { ctx, page, requests } = await newPage(browser, cond);
    try {
      await page.goto(`${BASE}/?edition=${ed.id}`);
      await waitMark(page, 'tracks-rendered', { detail: ed.tracks });
      await animationsDone(page, 'cover-in');
      const out = {};
      for (const [dir, label] of [['previous', 'Previous edition'], ['next', 'Next edition']]) {
        const before = requests.length;
        await page.getByRole('button', { name: label }).click();
        const t0 = await lastClick(page);
        const loaded = await waitMark(page, 'edition-loaded', { since: t0 });
        const painted = await waitMark(page, 'tracks-rendered', { since: loaded });
        out[dir] = { fetchDone: loaded - t0, tilesPainted: painted - t0, requests: requests.length - before, paths: requests.slice(before), longTasks: await longTaskStats(page, t0, painted) };
        await animationsDone(page, 'cover-in');
      }
      return out;
    } finally { await ctx.close(); }
  },
};

// Real cover images: small sample, unthrottled, pauses between runs. The cover
// URLs come with the edition, so the only Spotify requests are the images; any
// oEmbed request is counted because there should be none. Each run closes its
// page as soon as the tiles in the viewport show covers.
async function covers(browser) {
  const runs = [];
  const plan = args['cover-plan'].split(',').map(x => x.split(':')).map(([l, n]) => [EDITIONS.find(e => e.label === l), Number(n)]);
  for (const [ed, n] of plan) {
    for (let i = 0; i < n; i++) {
      const { ctx, page } = await newPage(browser, null, { region: ed.region, blockCovers: false });
      const lookups = [];
      page.on('request', r => { if (r.url().includes('/oembed')) lookups.push(r.url()); });
      const isImage = r => /\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/image\//.test(r.url());
      const statuses = [];
      let imageBytes = 0;
      page.on('response', r => { if (isImage(r)) { statuses.push(r.status()); imageBytes += Number(r.headers()['content-length'] || 0); } });
      page.on('requestfailed', r => { if (isImage(r)) statuses.push('failed'); });
      try {
        await loadWall(page, `${BASE}/`);
        const t0 = await openTile(page, ed);
        const painted = await waitMark(page, 'tracks-rendered', { detail: ed.tracks, since: t0 });
        await page.waitForTimeout(1200); // let the smooth scroll to the heading finish
        const geo = await page.evaluate(() => {
          const vh = innerHeight;
          const tiles = [...document.querySelectorAll('.cover-tile')].map(el => ({ id: el.dataset.trackId, r: el.getBoundingClientRect() }));
          return { visible: tiles.filter(t => t.r.bottom > 0 && t.r.top < vh).map(t => t.id), inMargin: tiles.filter(t => t.r.bottom > -400 && t.r.top < vh + 400).length };
        });
        const firstCover = await waitMark(page, 'cover-loaded', { since: t0, timeout: 20_000 }).catch(() => null);
        const settled = await page.waitForFunction(ids => {
          const got = new Map(performance.getEntriesByName('su:cover-loaded').map(e => [e.detail, e.startTime]));
          return ids.every(id => got.has(id)) ? Math.max(...ids.map(id => got.get(id))) : false;
        }, geo.visible, { timeout: 30_000, polling: 250 }).then(h => h.jsonValue()).catch(() => null);
        const run = { run: i + 1, edition: ed.label, tilesPainted: painted - t0, firstCover: firstCover && firstCover - t0,
          visibleTiles: geo.visible.length, visibleSettled: settled && settled - t0, tilesInObserverMargin: geo.inMargin,
          lookupsIssuedBySettle: lookups.length, imageStatuses: tally(statuses), imageBytes, coversLoaded: await page.evaluate(() => performance.getEntriesByName('su:cover-loaded').length) };
        runs.push(run);
        console.log(JSON.stringify(run));
        if (statuses.includes(429)) { console.log('Spotify returned 429 for an image: stopping the cover scenario'); return { runs, stopped: '429' }; }
      } finally { await ctx.close(); }
      await new Promise(r => setTimeout(r, 8000));
    }
  }
  return { runs };
}
// Our own limiter: spend all but one of the 300 edition requests with
// autocannon, load the page (the index takes the last one), open an edition
// and record what the panel shows; then reload with the budget at zero.
async function ratelimit(browser) {
  if (!process.env.PERF_RESTART) throw new Error('ratelimit needs PERF_RESTART (local server only)');
  execSync(process.env.PERF_RESTART, { stdio: 'ignore' });
  const ed = EDITIONS[2];
  execFileSync('bunx', ['autocannon', '-c', '1', '-a', '299', `${BASE}/spotify/editions/${EDITIONS[0].id}`], { stdio: 'ignore' });
  const { ctx, page } = await newPage(browser, null, { region: ed.region });
  const seen = [];
  page.on('response', r => { if (r.url().includes('/spotify/editions')) seen.push({ path: new URL(r.url()).pathname, status: r.status(), remaining: r.headers()['ratelimit-remaining'], reset: r.headers()['ratelimit-reset'], retryAfter: r.headers()['retry-after'] }); });
  const dir = new URL('./results/', import.meta.url).pathname;
  try {
    await loadWall(page, `${BASE}/`);
    await openTile(page, ed);
    const err = page.locator('.ep-error');
    await err.waitFor({ timeout: 10_000 });
    const panelText = await err.innerText();
    await page.locator('.edition-panel').screenshot({ path: `${dir}ratelimit-panel.png` });
    await page.reload();
    const wallErr = page.locator('.error-state');
    await wallErr.waitFor({ timeout: 10_000 });
    const wallText = await wallErr.innerText();
    await page.screenshot({ path: `${dir}ratelimit-wall.png` });
    return { responses: seen, panelText, wallText };
  } finally { await ctx.close(); execSync(process.env.PERF_RESTART, { stdio: 'ignore' }); }
}

const tally = xs => xs.reduce((o, x) => ({ ...o, [x]: (o[x] || 0) + 1 }), {});

// Percentile summary of every numeric leaf across runs.
function summarize(results) {
  const leaves = {};
  const walk = (o, p) => {
    for (const [k, v] of Object.entries(o || {})) {
      const key = p ? `${p}.${k}` : k;
      if (typeof v === 'number') (leaves[key] ||= []).push(v);
      else if (v && typeof v === 'object') walk(v, key);
    }
  };
  results.forEach(r => walk(r));
  const pct = (s, q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return Object.fromEntries(Object.entries(leaves).map(([k, xs]) => {
    const s = [...xs].sort((a, b) => a - b);
    const r = n => Math.round(n * 10) / 10;
    return [k, { n: s.length, p50: r(pct(s, 0.5)), p95: r(pct(s, 0.95)), min: r(s[0]), max: r(s.at(-1)) }];
  }));
}

const browser = await chromium.launch({ channel: process.env.PERF_CHANNEL || 'chrome', headless: true });
const out = { base: BASE, runs: RUNS, viewport: VIEWPORT, browser: browser.version(), started: new Date().toISOString(), conditions: CONDITIONS, editions: EDITIONS, phases: {} };
try {
  const scenarios = args.scenarios.split(',');
  if (scenarios.includes('covers')) out.covers = await covers(browser);
  if (scenarios.includes('ratelimit')) { out.ratelimit = await ratelimit(browser); console.log(JSON.stringify(out.ratelimit)); }
  for (const condName of args.conditions.split(',')) {
    for (const sc of scenarios.filter(s => !['covers', 'ratelimit'].includes(s))) {
      for (const ed of ['wall', 'region'].includes(sc) ? [null] : EDITIONS) {
        const phase = `${condName}/${sc}${ed ? `/${ed.label}` : ''}`;
        if (process.env.PERF_RESTART) execSync(process.env.PERF_RESTART, { stdio: 'ignore' });
        const results = []; const errors = [];
        for (let i = 0; i < RUNS; i++) {
          try { results.push(await SCENARIOS[sc](browser, CONDITIONS[condName], ed)); } catch (e) { errors.push(String(e.message).split('\n')[0]); }
        }
        out.phases[phase] = { summary: summarize(results), errors, raw: results };
        console.log(phase, `ok=${results.length} err=${errors.length}`, JSON.stringify(Object.fromEntries(Object.entries(out.phases[phase].summary).filter(([k]) => !k.includes('.')).map(([k, v]) => [k, `${v.p50}/${v.p95}`]))));
      }
    }
  }
} finally {
  await browser.close();
  out.finished = new Date().toISOString();
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  const file = args.out || new URL(`./results/flows-${Date.now()}.json`, import.meta.url).pathname;
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('wrote', file);
}
