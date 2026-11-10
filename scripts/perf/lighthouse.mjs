#!/usr/bin/env node
// First load of `/` with Lighthouse: N runs on the desktop preset with
// throttling off (--throttling-method=provided) and N on the default mobile preset (simulated slow 4G, 4x CPU).
//
//   node scripts/perf/lighthouse.mjs [--runs 5] [--base URL] [--presets desktop,mobile]
//
// Google Analytics and Spotify oEmbed/embed are blocked so test loads never
// reach the real analytics property; Google Fonts load from the network.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: process.env.PERF_BASE_URL || 'http://127.0.0.1:3100' },
    runs: { type: 'string', default: '5' },
    presets: { type: 'string', default: 'desktop,mobile' },
  },
});
const URL_ = `${args.base.replace(/\/$/, '')}/`;
const DIR = new URL('./results/lighthouse/', import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });
const BLOCK = ['*googletagmanager.com*', '*google-analytics.com*', '*open.spotify.com/oembed*', '*open.spotify.com/embed*'];
const stamp = Date.now();

const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = n => Math.round(n * 1000) / 1000;

function classify(item) {
  const u = item.url;
  if (u.includes('/spotify/editions')) return 'editionsIndex';
  if (u.includes('fonts.gstatic.com')) return 'fontFiles';
  if (u.includes('fonts.googleapis.com')) return 'fontCss';
  if (item.resourceType === 'Script') return 'js';
  if (item.resourceType === 'Stylesheet') return 'css';
  if (item.resourceType === 'Document') return 'html';
  return 'other';
}

const summary = { url: URL_, started: new Date().toISOString(), presets: {} };
for (const preset of args.presets.split(',')) {
  const runs = [];
  for (let i = 1; i <= Number(args.runs); i++) {
    const out = `${DIR}${preset}-${stamp}-${i}.json`;
    const flags = [
      'lighthouse', URL_, '--quiet', '--output=json', `--output-path=${out}`,
      '--only-categories=performance', '--chrome-flags=--headless=new',
      ...BLOCK.map(b => `--blocked-url-patterns=${b}`),
      // Desktop: the desktop form factor with no throttling at all (not the preset's simulated 4G).
      ...(preset === 'desktop' ? ['--preset=desktop', '--throttling-method=provided'] : []),
    ];
    try {
      execFileSync('bunx', flags, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      // Lighthouse sometimes exits non-zero while killing Chrome after writing a good report.
      console.warn(`lighthouse exited ${e.status}: ${String(e.stderr).trim().split('\n').slice(-3).join(' | ')}`);
    }
    const lhr = JSON.parse(readFileSync(out, 'utf8'));
    if (lhr.runtimeError) throw new Error(`lighthouse runtime error: ${lhr.runtimeError.message}`);
    const a = lhr.audits;
    const bytes = {};
    for (const item of a['network-requests'].details.items) {
      if (item.statusCode !== 200 && item.statusCode !== 304) continue;
      const k = classify(item);
      bytes[k] ||= { transfer: 0, raw: 0, count: 0 };
      bytes[k].transfer += item.transferSize || 0;
      bytes[k].raw += item.resourceSize || 0;
      bytes[k].count++;
    }
    const shifts = (a['layout-shifts']?.details?.items || []).map(x => ({ selector: x.node?.selector, score: x.score }));
    const blockedLeak = a['network-requests'].details.items.filter(x => BLOCK.some(b => x.url.includes(b.replaceAll('*', ''))) && x.statusCode > 0).length;
    const run = {
      shifts,
      blockedLeak,
      score: lhr.categories.performance.score * 100,
      fcp: a['first-contentful-paint'].numericValue,
      lcp: a['largest-contentful-paint'].numericValue,
      tbt: a['total-blocking-time'].numericValue,
      cls: a['cumulative-layout-shift'].numericValue,
      si: a['speed-index'].numericValue,
      tti: a.interactive?.numericValue,
      mainThread: a['mainthread-work-breakdown']?.numericValue,
      bootup: a['bootup-time']?.numericValue,
      totalTransfer: a['total-byte-weight'].numericValue,
      bytes,
      lighthouse: lhr.lighthouseVersion,
      userAgent: lhr.environment?.hostUserAgent,
      throttling: lhr.configSettings.throttlingMethod,
    };
    runs.push(run);
    console.log(preset, i, JSON.stringify({ fcp: r1(run.fcp), lcp: r1(run.lcp), tbt: r1(run.tbt), cls: run.cls, si: r1(run.si) }));
  }
  const stat = key => {
    const xs = runs.map(r => key.split('.').reduce((o, k) => o?.[k], r)).filter(x => typeof x === 'number');
    return { median: r1(median(xs)), min: r1(Math.min(...xs)), max: r1(Math.max(...xs)), n: xs.length };
  };
  summary.presets[preset] = {
    metrics: Object.fromEntries(['score', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'tti', 'mainThread', 'bootup', 'totalTransfer'].map(k => [k, stat(k)])),
    bytes: runs[0].bytes,
    shifts: runs.map(r => r.shifts),
    blockedLeak: runs.reduce((n, r) => n + r.blockedLeak, 0),
    lighthouse: runs[0].lighthouse,
    userAgent: runs[0].userAgent,
    throttling: runs[0].throttling,
  };
}
const file = `${DIR}summary-${stamp}.json`;
writeFileSync(file, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('wrote', file);
