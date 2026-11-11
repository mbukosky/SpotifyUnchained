#!/usr/bin/env node
// Headline numbers from the newest result files (or the ones named), either
// written out as a baseline or compared with one.
//
//   node scripts/perf/compare.mjs                      # compare newest results with docs/performance-baseline.json
//   node scripts/perf/compare.mjs --write docs/performance-baseline.json
//   node scripts/perf/compare.mjs --flows f.json --api a.json --lighthouse s.json
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    baseline: { type: 'string', default: 'docs/performance-baseline.json' },
    write: { type: 'string' },
    flows: { type: 'string' },
    api: { type: 'string' },
    lighthouse: { type: 'string' },
  },
});
const RES = new URL('./results/', import.meta.url).pathname;
const newest = (dir, re) => {
  const fs = existsSync(dir) ? readdirSync(dir).filter(f => re.test(f)).map(f => dir + f) : [];
  return fs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
};
const files = {
  flows: args.flows || newest(RES, /^flows-.*\.json$/),
  api: args.api || newest(RES, /^api-.*\.json$/),
  lighthouse: args.lighthouse || newest(`${RES}lighthouse/`, /^summary-.*\.json$/),
};
const data = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, f ? JSON.parse(readFileSync(f, 'utf8')) : null]));
const at = (o, path) => path.reduce((x, k) => x?.[k], o);

// [key, source, path, unit]
const METRICS = [];
for (const p of ['desktop', 'mobile']) {
  for (const m of ['fcp', 'lcp', 'tbt', 'si']) METRICS.push([`lighthouse.${p}.${m}.median`, 'lighthouse', ['presets', p, 'metrics', m, 'median'], 'ms']);
  METRICS.push([`lighthouse.${p}.cls.median`, 'lighthouse', ['presets', p, 'metrics', 'cls', 'median'], '']);
  METRICS.push([`lighthouse.${p}.totalTransfer.median`, 'lighthouse', ['presets', p, 'metrics', 'totalTransfer', 'median'], 'B']);
}
for (const e of ['editions-index', 'edition-31', 'edition-100', 'edition-149', 'edition-243', 'list-page1-size5']) {
  for (const q of ['p50', 'p95', 'p99']) METRICS.push([`api.${e}.${q}`, 'api', ['endpoints', e, 'sequential', q], 'ms']);
  METRICS.push([`api.${e}.bytesCompressed`, 'api', ['endpoints', e, 'bytesCompressed'], 'B']);
  METRICS.push([`api.${e}.bytesRaw`, 'api', ['endpoints', e, 'bytesRaw'], 'B']);
}
const EDS = ['small-31', 'medium-100', 'large-149'];
for (const c of ['unthrottled', 'fast4g', 'fast4g-cpu4']) {
  const ph = (...k) => ['phases', ...k, 'summary'];
  for (const q of ['p50', 'p95']) {
    METRICS.push([`flows.${c}.wall.wallDrawn.${q}`, 'flows', [...ph(`${c}/wall`), 'wallDrawn', q], 'ms']);
    METRICS.push([`flows.${c}.wall.longTasks.tbt.${q}`, 'flows', [...ph(`${c}/wall`), 'longTasks.tbt', q], 'ms']);
    for (const e of EDS) {
      for (const m of ['panelPainted', 'fetchDone', 'tilesPainted', 'longTasks.tbt']) METRICS.push([`flows.${c}.open.${e}.${m}.${q}`, 'flows', [...ph(`${c}/open/${e}`), m, q], 'ms']);
      METRICS.push([`flows.${c}.deeplink.${e}.tilesPainted.${q}`, 'flows', [...ph(`${c}/deeplink/${e}`), 'tilesPainted', q], 'ms']);
      for (const d of ['previous', 'next']) METRICS.push([`flows.${c}.step.${e}.${d}.tilesPainted.${q}`, 'flows', [...ph(`${c}/step/${e}`), `${d}.tilesPainted`, q], 'ms']);
    }
    for (const r of ['US', 'BR']) METRICS.push([`flows.${c}.region.${r}.wallDrawn.${q}`, 'flows', [...ph(`${c}/region`), `${r}.wallDrawn`, q], 'ms']);
  }
}

const current = {};
for (const [key, src, path, unit] of METRICS) {
  const v = at(data[src], path);
  if (typeof v === 'number') current[key] = { value: v, unit };
}

if (args.write) {
  const existing = existsSync(args.write) ? JSON.parse(readFileSync(args.write, 'utf8')) : {};
  writeFileSync(args.write, JSON.stringify({ ...existing, sources: files, metrics: current }, null, 2) + '\n');
  console.log(`wrote ${Object.keys(current).length} metrics to ${args.write}`);
} else {
  const base = JSON.parse(readFileSync(args.baseline, 'utf8')).metrics;
  console.log('metric'.padEnd(58), 'baseline'.padStart(10), 'now'.padStart(10), 'change'.padStart(9));
  for (const [key, b] of Object.entries(base)) {
    const n = current[key];
    if (!n) { console.log(key.padEnd(58), String(b.value).padStart(10), 'missing'.padStart(10)); continue; }
    const d = b.value ? ((n.value - b.value) / b.value) * 100 : 0;
    console.log(key.padEnd(58), String(b.value).padStart(10), String(n.value).padStart(10), `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`.padStart(9));
  }
}
