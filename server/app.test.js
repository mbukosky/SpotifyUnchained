import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import app from './app.js';

let server;
let base;

// Preflights are answered by the CORS layer itself, so these exercise it without
// reaching a controller (and therefore without needing a database).
const preflight = (path, origin) => fetch(`${base}${path}`, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
  },
});

beforeAll(async () => {
  await new Promise(resolve => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise(resolve => server.close(resolve)));

describe('CORS', () => {
  it('allows a configured origin on API routes', async () => {
    const res = await preflight('/api/spotify/token', 'http://localhost:3000');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('rejects an unknown origin without erroring the request', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await preflight('/api/spotify/token', 'https://evil.example.com');
    // No CORS headers, so the browser blocks the response — but the server does
    // not turn it into a 500 with a stack trace.
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.status).toBeLessThan(500);
    warn.mockRestore();
  });

  it('logs an unknown origin only once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const origin = 'https://repeat.example.com';
    await preflight('/api/spotify/token', origin);
    await preflight('/api/spotify/token', origin);
    const hits = warn.mock.calls.filter(([msg]) => String(msg).includes(origin));
    expect(hits).toHaveLength(1);
    warn.mockRestore();
  });

  it('does not apply to non-API paths, so a foreign Origin cannot 500 them', async () => {
    const res = await fetch(`${base}/wp-admin/setup.php`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('trust proxy', () => {
  it('is off by default, so a local request cannot spoof its address', () => {
    expect(app.get('trust proxy')).toBe(false);
  });

  it('trusts exactly one hop in production, so rate limits key on the real client', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    // A second copy of app.js re-runs the model definitions it pulls in.
    mongoose.deleteModel(/.*/);
    const { default: prodApp } = await import('./app.js?trust-proxy');
    expect(prodApp.get('trust proxy')).toBe(1);
    vi.unstubAllEnvs();
  });
});

describe('unmatched routes', () => {
  it('returns JSON 404 rather than an empty body', async () => {
    const res = await fetch(`${base}/definitely/not/a/route`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('/health', () => {
  it('is a real route that reports the database, not the SPA shell', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // No database is connected in tests, so the check must fail loudly.
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unavailable' });
    error.mockRestore();
  });
});
