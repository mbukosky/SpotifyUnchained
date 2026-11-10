import type { Browser } from '@e2e-dev/web';
import type { JsonValue } from 'e2e';

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const REGIONS = ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];

/** The fixed `_id` seed.js gives a playlist: "e2e", region number, "00", the label's digits, a suffix. */
export const editionId = (region: string, label = '02.14.2026', suffix = '000000000') =>
  `e2e${String(REGIONS.indexOf(region) + 1).padStart(2, '0')}00${label.replace(/\./g, '')}${suffix}`;

/** A region tile's accessible name, e.g. "Saturday, February 14, 2026, 30 tracks". */
export const tileName = (date: string, tracks: number) => `${date}, ${tracks} ${tracks === 1 ? 'track' : 'tracks'}`;

/** An ALL tile's accessible name, e.g. "Week of Saturday, February 14, 2026, 7 regions". */
export const weekTileName = (date: string, regions: number) =>
  `Week of ${date}, ${regions} ${regions === 1 ? 'region' : 'regions'}`;

/** The seed's newest week, as tiles and the panel title write it. */
export const FEB_14 = 'Saturday, February 14, 2026';
export const FEB_07 = 'Saturday, February 7, 2026';

/** The open edition panel, as a CSS selector. */
export const PANEL = '.edition-panel';

/** Loads the page with an edition open, the way a shared link does. */
export const openEdition = (app: { open: (path: string) => Promise<unknown> }, id: string) =>
  app.open(`/?edition=${id}`);

/** The `edition` query parameter of the page's current URL, or null. */
export const editionParam = async (browser: Browser) => new URL(await browser.url()).searchParams.get('edition');

/** Starts the page on a region, as if the visitor had picked it before. */
export async function presetRegion(browser: Browser, region: string) {
  await browser.addInitScript((value: string) => {
    try {
      if (!localStorage.getItem('selectedRegion')) localStorage.setItem('selectedRegion', value);
    } catch {
      // Blocked frames have no storage.
    }
  }, region);
}

/** The edition index request, and only it: not a single edition's. */
export const EDITION_INDEX = /127\.0\.0\.1:3100\/spotify\/editions(\?.*)?$/;

/** Answers the edition index from the browser, for tests that don't care about it. */
export async function stubEmptyArchive(browser: Browser) {
  await browser.route(EDITION_INDEX, (route) => route.fulfill({ json: { items: [] } }));
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
