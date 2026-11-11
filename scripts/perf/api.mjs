#!/usr/bin/env node
// API latency and payload sizes. For each endpoint: one gzip and one identity
// request for sizes and headers, a sequential timing sample (exact
// p50/p95/p99), then `bunx autocannon` with a fixed request count. Counts are
// sized to fit the rate limits (editions 300/15 min, /spotify 100/15 min);
// PERF_RESTART runs before each endpoint so a local server starts fresh.
//
//   PERF_RESTART="scripts/perf/server.sh restart" node scripts/perf/api.mjs [--base URL]
import { execFileSync, execSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.PERF_BASE_URL || 'http://127.0.0.1:3100' },
    scale: { type: 'string', default: '1' }, // multiply request counts (e.g. 0.2 against production)
  },
});
const BASE = args.base.replace(/\/$/, '');
const S = Number(args.scale);
const ENDPOINTS = JSON.parse(process.env.PERF_API_ENDPOINTS || JSON.stringify([
  { label: 'editions-index', path: '/spotify/editions', sample: 60, amount: 200 },
  { label: 'edition-31', path: '/spotify/editions/54fb254277d74fdd53267270', sample: 60, amount: 200 },
  { label: 'edition-100', path: '/spotify/editions/6adbedd6034af47a69a6e9ff', sample: 60, amount: 200 },
  { label: 'edition-149', path: '/spotify/editions/6992257ccd64e387a22e1bb1', sample: 60, amount: 200 },
  { label: 'edition-243', path: '/spotify/editions/6992256ecd64e387a22e1abb', sample: 60, amount: 200 },
  { label: 'list-page1-size5', path: '/spotify?page=1&size=5', sample: 30, amount: 60 },
]));

function get(path, encoding) {
  const url = new URL(BASE + path);
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const t = process.hrtime.bigint();
    lib.get(url, { headers: { 'accept-encoding': encoding }, agent: false }, res => {
      let bytes = 0;
      let ttfb = null;
      res.on('data', c => { ttfb ??= Number(process.hrtime.bigint() - t) / 1e6; bytes += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes, ttfb, ms: Number(process.hrtime.bigint() - t) / 1e6 }));
    }).on('error', reject);
  });
}

const pct = (s, q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
const r1 = n => Math.round(n * 100) / 100;

const out = { base: BASE, started: new Date().toISOString(), node: process.version, endpoints: {} };
for (const ep of ENDPOINTS) {
  if (process.env.PERF_RESTART) execSync(process.env.PERF_RESTART, { stdio: 'ignore' });
  const gz = await get(ep.path, 'gzip, deflate, br');
  const plain = await get(ep.path, 'identity');
  const sampleN = Math.max(5, Math.round(ep.sample * S));
  const times = [];
  for (let i = 0; i < sampleN; i++) times.push((await get(ep.path, 'gzip, deflate, br')).ms);
  const s = [...times].sort((a, b) => a - b);
  const amount = Math.max(10, Math.round(ep.amount * S));
  const ac = JSON.parse(execFileSync('bunx', ['autocannon', '--json', '-c', '1', '-a', String(amount),
    '-H', 'accept-encoding=gzip, deflate, br', BASE + ep.path], { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  const after = await get(ep.path, 'gzip, deflate, br');
  const res = {
    path: ep.path,
    status: gz.status,
    contentEncoding: gz.headers['content-encoding'] || 'none',
    cacheControl: gz.headers['cache-control'],
    bytesCompressed: gz.bytes,
    bytesRaw: plain.bytes,
    rateLimit: { policy: gz.headers['ratelimit-policy'], limit: gz.headers['ratelimit-limit'], remainingAfterFirst: gz.headers['ratelimit-remaining'], remainingAtEnd: after.headers['ratelimit-remaining'], statusAtEnd: after.status },
    sequential: { n: s.length, first: r1(times[0]), p50: r1(pct(s, 0.5)), p95: r1(pct(s, 0.95)), p99: r1(pct(s, 0.99)), min: r1(s[0]), max: r1(s.at(-1)) },
    autocannon: {
      requests: amount, connections: 1, non2xx: ac.non2xx, errors: ac.errors,
      p50: ac.latency.p50, p90: ac.latency.p90, p97_5: ac.latency.p97_5, p99: ac.latency.p99, max: ac.latency.max, mean: r1(ac.latency.mean),
      rps: r1(ac.requests.mean), bytesPerReq: Math.round(ac.throughput.total / Math.max(1, ac.requests.total)),
    },
  };
  out.endpoints[ep.label] = res;
  console.log(ep.label, JSON.stringify({ enc: res.contentEncoding, compressed: res.bytesCompressed, raw: res.bytesRaw, seq: res.sequential, ac: res.autocannon, rl: res.rateLimit }));
}
out.finished = new Date().toISOString();
const dir = new URL('./results/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const file = `${dir}api-${Date.now()}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log('wrote', file);
