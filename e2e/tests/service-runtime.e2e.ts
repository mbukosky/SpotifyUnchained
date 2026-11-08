import { expect } from 'e2e';
import { test } from './fixtures.ts';
import { asClient, stubEmptyArchive } from './helpers.ts';

// Spot checks of what a browser or HTTP client can see. Startup, logging and
// database-failure behavior needs a process or a database to break, so it stays
// in Vitest. The server runs with NODE_ENV=production here.

const APP_ORIGIN = 'http://127.0.0.1:3100';

/** The directives of a Content-Security-Policy header, keyed by name. */
const parseCsp = (header: string | null) =>
  Object.fromEntries(
    (header ?? '').split(';').map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );

// openspec/specs/service-runtime/spec.md
// Requirement: Health check reports database readiness. Scenario: Database answers.
test('health reports ok while the database answers', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/health`, { headers: asClient('203.0.113.40') });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers.get('cache-control')).toBe('no-store');
});

// openspec/specs/service-runtime/spec.md
// Requirement: Health check reports database readiness. Scenario: Health endpoint rate limited.
test('health is rate limited after 30 requests', async ({ app }) => {
  const headers = asClient('203.0.113.41');
  for (let i = 0; i < 30; i++) {
    expect((await fetch(`${app.baseUrl}/health`, { headers })).status).toBe(200);
  }

  const response = await fetch(`${app.baseUrl}/health`, { headers });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ status: 'rate_limited' });
  expect(response.headers.get('ratelimit-limit')).toBe('30');
});

// openspec/specs/service-runtime/spec.md
// Requirement: Content security policy. Scenario: Policy source lists.
test('API responses carry the content security policy', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/health`, { headers: asClient('203.0.113.42') });
  const csp = parseCsp(response.headers.get('content-security-policy'));

  expect(csp['default-src']).toEqual(["'self'"]);
  expect(csp['script-src']).toEqual([
    "'self'",
    "'unsafe-inline'",
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
  ]);
  expect(csp['style-src']).toEqual(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
  expect(csp['font-src']).toEqual(["'self'", 'https://fonts.gstatic.com']);
  expect(csp['img-src']).toEqual([
    "'self'",
    'data:',
    'https://www.google-analytics.com',
    'https://i.scdn.co',
    'https://cdn.ko-fi.com',
    'https://storage.ko-fi.com',
  ]);
  expect(csp['frame-src']).toEqual(['https://open.spotify.com']);
  expect(csp['connect-src']).toEqual([
    "'self'",
    'https://accounts.spotify.com',
    'https://api.spotify.com',
    'https://www.google-analytics.com',
  ]);
});

// openspec/specs/service-runtime/spec.md
// Requirement: Content security policy. Scenario: Policy on a static asset.
test('static assets carry the same policy', async ({ app }) => {
  const [api, asset] = await Promise.all([
    fetch(`${app.baseUrl}/health`, { headers: asClient('203.0.113.43') }),
    fetch(`${app.baseUrl}/favicon.svg`),
  ]);

  expect(asset.status).toBe(200);
  expect(asset.headers.get('content-security-policy')).toBe(api.headers.get('content-security-policy'));
});

// openspec/specs/service-runtime/spec.md
// Requirement: Content security policy. Scenario: Third-party source not listed.
test('the browser blocks a script from an unlisted host', async ({ app, browser }) => {
  await stubEmptyArchive(browser);
  await app.open('/');

  // A violation event only fires for the policy, so appHostOnly can't be what stopped it.
  const blocked = await browser.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener('securitypolicyviolation', (event) => {
          resolve(`${event.effectiveDirective} ${event.blockedURI}`);
        });
        const script = document.createElement('script');
        script.src = 'https://unlisted.example.com/x.js';
        document.head.append(script);
      }),
  );

  expect(blocked).toBe('script-src-elem https://unlisted.example.com/x.js');
});

// openspec/specs/service-runtime/spec.md
// Requirement: Transport and referrer headers. Scenario: Headers on an API response.
test('API responses carry the transport and referrer headers', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/health`, { headers: asClient('203.0.113.44') });

  expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
});

// openspec/specs/service-runtime/spec.md
// Requirement: CORS scope and origin allow-list. Scenario: Configured origin on an API path.
// The configured origin here is the e2e app's, not the scenario's localhost:3000.
test('preflight from a configured origin is allowed', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'OPTIONS',
    headers: { origin: APP_ORIGIN, 'access-control-request-method': 'POST', ...asClient('203.0.113.45') },
  });

  expect(response.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
});

// openspec/specs/service-runtime/spec.md
// Requirement: CORS scope and origin allow-list. Scenario: Request without an Origin header.
test('a request with no Origin is processed', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/spotify?size=1`, { headers: asClient('203.0.113.53') });

  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

// openspec/specs/service-runtime/spec.md
// Requirement: CORS scope and origin allow-list. Scenario: Non-API path with a foreign origin.
test('a non-API path gets no CORS headers', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/wp-admin/setup.php`, {
    headers: { origin: 'https://evil.example.com' },
  });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Not found' });
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
});

// openspec/specs/service-runtime/spec.md
// Requirement: Unknown origins are denied quietly. Scenario: Unknown origin preflight.
test('preflight from an unknown origin is denied without an error', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://evil.example.com',
      'access-control-request-method': 'POST',
      ...asClient('203.0.113.46'),
    },
  });

  expect(response.headers.get('access-control-allow-origin')).toBeNull();
  expect(response.status).toBeLessThan(500);
});

// openspec/specs/service-runtime/spec.md
// Requirement: JSON request body limit. Scenario: Oversized JSON body.
// Rejected while parsing, so the token handler never runs and Spotify isn't contacted.
test('an oversized JSON body is rejected', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...asClient('203.0.113.47') },
    body: JSON.stringify({ code: 'x'.repeat(11 * 1024) }),
  });

  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: 'Internal server error' });
});

// openspec/specs/service-runtime/spec.md
// Requirement: API rate limiting. Scenario: Request over the limit.
test('API paths answer 429 on the 101st request', async ({ app }) => {
  const headers = asClient('203.0.113.48');
  for (let i = 0; i < 100; i++) {
    expect((await fetch(`${app.baseUrl}/api/not-a-route.json`, { headers })).status).toBe(404);
  }

  const response = await fetch(`${app.baseUrl}/api/not-a-route.json`, { headers });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Too many requests, please try again later.' });
});

// openspec/specs/service-runtime/spec.md
// Requirement: API rate limiting. Scenario: Standard headers only.
test('API responses use only standard rate-limit headers', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/not-a-route.json`, { headers: asClient('203.0.113.49') });
  const names = [...response.headers.keys()];

  expect(response.headers.get('ratelimit-limit')).toBe('100');
  expect(names.filter((name) => name.startsWith('x-ratelimit'))).toEqual([]);
});

// openspec/specs/service-runtime/spec.md
// Requirement: Client address for rate limiting. Scenario: Production behind the edge proxy.
test('rate limits key on the forwarded address in production', async ({ app }) => {
  const remaining = async (ip: string) => {
    const response = await fetch(`${app.baseUrl}/api/not-a-route.json`, { headers: asClient(ip) });
    return Number(response.headers.get('ratelimit-remaining'));
  };

  expect(await remaining('203.0.113.50')).toBe(99);
  expect(await remaining('203.0.113.50')).toBe(98);
  expect(await remaining('203.0.113.51')).toBe(99);
});

// openspec/specs/service-runtime/spec.md
// Requirement: Production client serving and SPA fallback. Scenario: Client route in production.
test('a client route serves the app shell', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/some/client/route`);

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(await response.text()).toContain('<div id="root"></div>');
});

// openspec/specs/service-runtime/spec.md
// Requirement: Production client serving and SPA fallback. Scenario: Missing file in production.
test('a missing file answers the JSON 404', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/missing.js`);

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Not found' });
});

// openspec/specs/service-runtime/spec.md
// Requirement: JSON 404 for unmatched routes. Scenario: Unknown route.
// POST, because in production a GET with no file extension is the SPA fallback.
test('an unknown route answers the JSON 404', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/definitely/not/a/route`, { method: 'POST' });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Not found' });
});

// openspec/specs/service-runtime/spec.md
// Requirement: Sanitized error responses. Scenario: Error with a status.
// Malformed JSON makes the body parser raise a 400, the one such error HTTP can reach.
test('an error with a status keeps it and hides the detail', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...asClient('203.0.113.52') },
    body: '{not json',
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Internal server error' });
});
