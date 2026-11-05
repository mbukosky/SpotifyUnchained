import type { Browser } from '@e2e-dev/web';
import type { JsonValue } from 'e2e';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The Toggle button on a playlist card; its accessible name holds the raw title. */
export const toggleName = (region: string, label = '02.14.2026') =>
  `Toggle New.Music.Friday.${region}.${label}`;

/** A playlist card, as a CSS selector. */
export const cardSelector = (region: string, label = '02.14.2026') =>
  `article:has([aria-label="${toggleName(region, label)}"])`;

/** Titles of the listed cards, top to bottom, with the display spacing removed. */
export async function listedTitles(browser: Browser) {
  const titles = await browser.locator('.pcard-title').allTextContents();
  return titles.map((title) => title.replace(/\s/g, ''));
}

/** Starts the page on a region, so a test needs one /spotify request rather than two. */
export async function presetRegion(browser: Browser, region: string) {
  await browser.addInitScript((value: string) => {
    try {
      if (!localStorage.getItem('selectedRegion')) localStorage.setItem('selectedRegion', value);
    } catch {
      // Blocked frames have no storage.
    }
  }, region);
}

/** Answers the archive request from the browser, for tests that don't care about it. */
export async function stubEmptyArchive(browser: Browser) {
  await browser.route(/127\.0\.0\.1:3100\/spotify\?/, (route) =>
    route.fulfill({ json: { count: 0, items: [] } }),
  );
}

/** Puts a Spotify session in sessionStorage once, so it can later end or change. */
export async function seedSession(
  browser: Browser,
  session: { accessToken?: string; refreshToken?: string; expiresInMs?: number } = {},
) {
  await browser.addInitScript(
    (s: { accessToken: string; refreshToken: string | null; expiresInMs: number }) => {
      try {
        if (location.protocol !== 'http:' || sessionStorage.getItem('e2e_seeded')) return;
        sessionStorage.setItem('e2e_seeded', '1');
        sessionStorage.setItem('spotify_access_token', s.accessToken);
        if (s.refreshToken) sessionStorage.setItem('spotify_refresh_token', s.refreshToken);
        sessionStorage.setItem('spotify_expires_at', String(Date.now() + s.expiresInMs));
      } catch {
        // Blocked frames have no storage.
      }
    },
    {
      accessToken: session.accessToken ?? 'e2e-access-token',
      refreshToken: session.refreshToken ?? null,
      expiresInMs: session.expiresInMs ?? 60 * 60 * 1000,
    },
  );
}

/** Reads a sessionStorage key from the page. */
export const sessionValue = (browser: Browser, key: string) =>
  browser.evaluate((name: string) => sessionStorage.getItem(name), key);

export const SESSION_KEYS = ['spotify_access_token', 'spotify_refresh_token', 'spotify_expires_at'];

/**
 * Records redirects to Spotify's authorize page and answers with a stub page, so
 * nothing reaches Spotify. The app's page is gone afterwards: `browser.back()`
 * returns to it with its sessionStorage intact.
 */
export async function mockAuthorize(browser: Browser) {
  const urls: string[] = [];
  await browser.route('https://accounts.spotify.com/**', async (route) => {
    urls.push(route.request.url);
    await route.fulfill({ contentType: 'text/html', body: '<title>Stub authorize page</title>' });
  });
  return urls;
}

export interface SpotifyCall {
  method: string;
  path: string;
  body: any;
  at: number;
}

type Json = JsonValue;
type SpotifyReply = { status: number; json?: Json; headers?: Record<string, string> };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': 'retry-after',
};

/**
 * Stands in for api.spotify.com and records every call. `respond` overrides a
 * reply; returning nothing uses the happy-path default.
 */
export async function mockSpotifyApi(
  browser: Browser,
  respond: (call: SpotifyCall, calls: SpotifyCall[]) => SpotifyReply | void = () => {},
) {
  const calls: SpotifyCall[] = [];
  await browser.route('https://api.spotify.com/**', async (route) => {
    const { method, url, postData } = route.request;
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const call: SpotifyCall = {
      method,
      path: new URL(url).pathname.replace('/v1', ''),
      body: postData ? JSON.parse(postData) : undefined,
      at: Date.now(),
    };
    calls.push(call);

    let reply = respond(call, calls) ?? undefined;
    if (!reply) {
      if (call.path === '/me') {
        reply = { status: 200, json: { id: 'e2e-user', display_name: 'E2E Listener' } };
      } else if (call.path.endsWith('/tracks')) {
        reply = { status: 201, json: { snapshot_id: 'e2e-snapshot' } };
      } else {
        reply = { status: 201, json: { id: 'e2e-playlist' } };
      }
    }
    await route.fulfill({
      status: reply.status,
      json: reply.json ?? {},
      headers: { ...CORS, ...reply.headers },
    });
  });
  return calls;
}

/** Calls that make up a save: everything but the profile lookups. */
export const saveCalls = (calls: SpotifyCall[]) => calls.filter((call) => call.method === 'POST');

/**
 * Stands in for the app's own token endpoints from the browser. The real ones
 * call accounts.spotify.com from the server, where no browser route can stop
 * them, so a browser test must never let these requests through.
 */
export async function mockTokenEndpoints(
  browser: Browser,
  handlers: {
    token?: { status: number; json: Json };
    refresh?: { status: number; json: Json } | 'abort';
  } = {},
) {
  const calls = { token: [] as any[], refresh: [] as any[] };
  await browser.route('**/api/spotify/token', async (route) => {
    calls.token.push(JSON.parse(route.request.postData ?? '{}'));
    await route.fulfill(
      handlers.token ?? {
        status: 200,
        json: { access_token: 'e2e-new-access', refresh_token: 'e2e-new-refresh', expires_in: 3600 },
      },
    );
  });
  await browser.route('**/api/spotify/refresh', async (route) => {
    calls.refresh.push(JSON.parse(route.request.postData ?? '{}'));
    if (handlers.refresh === 'abort') {
      await route.abort();
      return;
    }
    await route.fulfill(
      handlers.refresh ?? {
        status: 200,
        json: { access_token: 'e2e-new-access', refresh_token: 'e2e-new-refresh', expires_in: 3600 },
      },
    );
  });
  return calls;
}

/**
 * The production server trusts one proxy hop, so a forwarded address is a
 * separate rate-limit client. Tests that exhaust a limit use their own, which
 * leaves the budget the rest of the suite shares untouched.
 */
export const asClient = (ip: string) => ({ 'x-forwarded-for': ip });
