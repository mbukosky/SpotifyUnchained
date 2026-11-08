import { createHash } from 'node:crypto';
import { expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { test } from './fixtures.ts';
import {
  asClient,
  mockAuthorize,
  mockSpotifyApi,
  mockTokenEndpoints,
  seedSession,
  SESSION_KEYS,
  sessionValue,
  sleep,
  stubEmptyArchive,
} from './helpers.ts';

const BANNER = 'Your Spotify session expired — please sign in again.';

/** Stores the PKCE values a sign-in would have left, as if returning from Spotify. */
async function seedPendingSignIn(browser: Browser, values: { state?: string; verifier?: string }) {
  await browser.addInitScript((v: { state: string | null; verifier: string | null }) => {
    try {
      if (location.protocol !== 'http:' || sessionStorage.getItem('e2e_pending')) return;
      sessionStorage.setItem('e2e_pending', '1');
      if (v.state) sessionStorage.setItem('spotify_auth_state', v.state);
      if (v.verifier) sessionStorage.setItem('spotify_code_verifier', v.verifier);
    } catch {
      // Blocked frames have no storage.
    }
  }, { state: values.state ?? null, verifier: values.verifier ?? null });
}

const session = (browser: Browser) =>
  Promise.all(SESSION_KEYS.map((key) => sessionValue(browser, key)));

test.beforeEach(async ({ browser }) => {
  // None of these tests read the archive, so they don't spend the shared request budget.
  await stubEmptyArchive(browser);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: PKCE sign-in redirect. Scenario: User clicks Sign in.
test('sign-in redirects to Spotify with PKCE', async ({ agent, app, screen, browser }) => {
  const authorize = await mockAuthorize(browser);
  await app.open('/');

  await agent.act('Sign in with Spotify');
  await expect(browser).toHaveURL(/^https:\/\/accounts\.spotify\.com\/authorize\?/);
  await expect.poll(() => authorize.length).toBe(1);
  await browser.back();

  const verifier = (await sessionValue(browser, 'spotify_code_verifier'))!;
  const state = (await sessionValue(browser, 'spotify_auth_state'))!;
  expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{128}$/);
  expect(state).toMatch(/^[A-Za-z0-9\-._~]{64}$/);

  const url = new URL(authorize[0]);
  expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    // Also guards the build: a real ID here means the bundle was built from .env.
    client_id: 'e2e-client-id',
    response_type: 'code',
    redirect_uri: `${app.baseUrl}/callback`,
    scope: 'playlist-modify-public playlist-modify-private',
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    state,
  });
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Callback state validation. Scenario: Matching state.
test('callback with a matching state exchanges the code', async ({ app, screen, browser }) => {
  const tokens = await mockTokenEndpoints(browser);
  await mockSpotifyApi(browser);
  await seedPendingSignIn(browser, { state: 'good-state', verifier: 'good-verifier' });

  await app.open('/callback?code=auth-code&state=good-state');

  await expect(screen.getByRole('button', 'Sign out of Spotify')).toBeVisible();
  expect(tokens.token).toEqual([
    { code: 'auth-code', code_verifier: 'good-verifier', redirect_uri: `${app.baseUrl}/callback` },
  ]);
  expect(await sessionValue(browser, 'spotify_auth_state')).toBeNull();
  await expect(browser).toHaveURL(`${app.baseUrl}/callback`);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Callback state validation. Scenario: Mismatched or missing state.
test('callback with a bad or missing state is refused', async ({ app, screen, browser }) => {
  const tokens = await mockTokenEndpoints(browser);
  await seedPendingSignIn(browser, { state: 'good-state', verifier: 'good-verifier' });

  for (const query of ['code=auth-code&state=forged', 'code=auth-code']) {
    await app.open(`/callback?${query}`);

    await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible();
    await expect(browser).toHaveURL(`${app.baseUrl}/callback`);
    expect(await sessionValue(browser, 'spotify_auth_state')).toBeNull();
    expect(await sessionValue(browser, 'spotify_code_verifier')).toBeNull();

    // Put them back, so the second case starts from the same state as the first.
    await browser.evaluate(() => {
      sessionStorage.setItem('spotify_auth_state', 'good-state');
      sessionStorage.setItem('spotify_code_verifier', 'good-verifier');
      return null;
    });
  }
  await sleep(300);
  expect(tokens.token).toEqual([]);
  expect(await sessionValue(browser, 'spotify_access_token')).toBeNull();
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Callback state validation. Scenario: State matches but verifier is absent.
test('callback without a stored verifier does not exchange', async ({ app, screen, browser }) => {
  const tokens = await mockTokenEndpoints(browser);
  await seedPendingSignIn(browser, { state: 'good-state' });

  await app.open('/callback?code=auth-code&state=good-state');

  await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible();
  await sleep(300);
  expect(tokens.token).toEqual([]);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Token exchange endpoint. Scenario: Required parameter missing.
// Safe against the real server: it answers before contacting Spotify.
test('token exchange rejects a missing parameter', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...asClient('203.0.113.20') },
    body: JSON.stringify({ code: 'a', redirect_uri: 'http://localhost:3000/callback' }),
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Missing required parameters: code, code_verifier, redirect_uri' });
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Redirect URI allowlist. Scenario: Disallowed redirect URI.
// Safe against the real server: it answers before contacting Spotify.
test('token exchange rejects a disallowed redirect URI', async ({ app }) => {
  const response = await fetch(`${app.baseUrl}/api/spotify/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...asClient('203.0.113.21') },
    body: JSON.stringify({ code: 'a', code_verifier: 'b', redirect_uri: 'https://evil.example.com/callback' }),
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Invalid redirect_uri' });
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Token endpoint rate limit. Scenario: Limit exceeded.
// Every request lacks parameters, so the server never contacts Spotify, limited or not.
test('token endpoints stop after 20 requests', async ({ app }) => {
  const post = (path: string) =>
    fetch(`${app.baseUrl}/api/spotify/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...asClient('203.0.113.22') },
      body: '{}',
    });
  for (let i = 0; i < 10; i++) {
    expect((await post('token')).status).toBe(400);
    expect((await post('refresh')).status).toBe(400);
  }

  const response = await post('token');

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Too many token requests, please try again later.' });
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Session storage. Scenario: Tokens received.
test('received tokens go to sessionStorage only', async ({ app, screen, browser }) => {
  await mockTokenEndpoints(browser);
  await mockSpotifyApi(browser);
  await seedPendingSignIn(browser, { state: 'good-state', verifier: 'good-verifier' });
  const before = Date.now();

  await app.open('/callback?code=auth-code&state=good-state');
  await expect(screen.getByRole('button', 'Sign out of Spotify')).toBeVisible();

  const [access, refresh, expires] = await session(browser);
  expect(access).toBe('e2e-new-access');
  expect(refresh).toBe('e2e-new-refresh');
  expect(Number(expires)).toBeGreaterThanOrEqual(before + 3600 * 1000);
  expect(Number(expires)).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
  const local = await browser.evaluate((keys: string[]) => keys.map((key) => localStorage.getItem(key)), SESSION_KEYS);
  expect(local).toEqual([null, null, null]);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Session storage. Scenario: Refresh response omits refresh token.
test('refresh without a new refresh token keeps the old one', async ({ app, browser }) => {
  await mockTokenEndpoints(browser, {
    refresh: { status: 200, json: { access_token: 'refreshed-access', expires_in: 3600 } },
  });
  await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'old-refresh', expiresInMs: 60_000 });

  await app.open('/');

  await expect.poll(() => sessionValue(browser, 'spotify_access_token')).toBe('refreshed-access');
  expect(await sessionValue(browser, 'spotify_refresh_token')).toBe('old-refresh');
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Session storage. Scenario: Page reload in the same tab.
test('session is restored after a reload', async ({ app, screen, browser }) => {
  await mockSpotifyApi(browser);
  await seedSession(browser);
  await app.open('/');
  await expect(browser.locator('.spotify-user-name')).toHaveText('E2E Listener');

  await browser.reload();

  await expect(browser.locator('.spotify-user-name')).toHaveText('E2E Listener');
  await expect(screen.getByRole('button', 'Sign out of Spotify')).toBeVisible();
  expect(await sessionValue(browser, 'spotify_access_token')).toBe('e2e-access-token');
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Session storage. Scenario: New tab.
test('a tab with no stored session is signed out', async ({ app, screen }) => {
  await app.open('/');

  await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible();
  await expect(screen.getByRole('button', 'Sign out of Spotify')).toHaveCount(0);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Authenticated state. Scenario: Token expires without refresh.
test('session ends when the token expires with no refresh token', async ({ app, screen, browser }) => {
  await mockSpotifyApi(browser);
  await seedSession(browser, { expiresInMs: 2500 });

  await app.open('/');
  await expect(screen.getByRole('button', 'Sign out of Spotify')).toBeVisible();

  await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible({ timeout: 6000 });
  expect(await session(browser)).toEqual([null, null, null]);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Authenticated state. Scenario: Profile lookup fails.
test('profile lookup retries once, but not after a 401', async ({ app, browser }) => {
  let status = 500;
  const calls = await mockSpotifyApi(browser, () => ({ status }));
  await seedSession(browser);

  await app.open('/');
  await expect.poll(() => calls.length, { timeout: 4000 }).toBe(2);
  const gap = calls[1].at - calls[0].at;
  expect(gap).toBeGreaterThanOrEqual(1400);
  expect(gap).toBeLessThan(3000);
  await expect(browser.locator('.spotify-user-name')).toHaveText('User');

  // Only one retry, however long it keeps failing.
  await sleep(2000);
  expect(calls.length).toBe(2);

  status = 401;
  calls.length = 0;
  await browser.reload();
  await expect.poll(() => calls.length).toBe(1);
  await sleep(2000);
  expect(calls.length).toBe(1);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Proactive refresh. Scenario: Scheduled refresh.
test('token within five minutes of expiry is refreshed', async ({ app, browser }) => {
  const tokens = await mockTokenEndpoints(browser);
  await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'old-refresh', expiresInMs: 4 * 60 * 1000 });

  await app.open('/');

  await expect.poll(() => tokens.refresh.length).toBe(1);
  expect(tokens.refresh[0]).toEqual({ refresh_token: 'old-refresh' });
  await expect.poll(() => sessionValue(browser, 'spotify_access_token')).toBe('e2e-new-access');
  expect(await sessionValue(browser, 'spotify_refresh_token')).toBe('e2e-new-refresh');
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Refresh failure ends the session. Scenario: Refresh token invalid.
test('invalid_grant clears the session and sets session-expired', async ({ app, screen, browser }) => {
  const tokens = await mockTokenEndpoints(browser, { refresh: { status: 400, json: { error: 'invalid_grant' } } });
  await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'dead-refresh', expiresInMs: 60_000 });

  await app.open('/');

  await expect(screen.getByText(BANNER)).toBeVisible();
  expect(await session(browser)).toEqual([null, null, null]);
  await sleep(500);
  expect(tokens.refresh.length).toBe(1);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Refresh failure ends the session. Scenario: Refresh fails for another reason.
for (const [name, refresh] of [
  ['an error response', { status: 500, json: { error: 'Token refresh failed' } }],
  ['a failed request', 'abort'],
] as const) {
  test(`refresh failing with ${name} clears the session without the notice`, async ({ app, screen, browser }) => {
    const tokens = await mockTokenEndpoints(browser, { refresh });
    await mockSpotifyApi(browser);
    await seedSession(browser, { refreshToken: 'some-refresh', expiresInMs: 60_000 });

    await app.open('/');

    await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible();
    await expect.poll(() => tokens.refresh.length).toBe(1);
    expect(await session(browser)).toEqual([null, null, null]);
    await expect(screen.getByText(BANNER)).toHaveCount(0);
  });
}

// openspec/specs/spotify-auth/spec.md
// Requirement: Session-expired notice. Scenario: Banner shown after invalid grant.
test('session-expired banner shows its message and buttons', async ({ agent, app, screen, browser }) => {
  const authorize = await mockAuthorize(browser);
  await mockTokenEndpoints(browser, { refresh: { status: 400, json: { error: 'invalid_grant' } } });
  await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'dead-refresh', expiresInMs: 60_000 });

  await app.open('/');

  const banner = screen.getByRole('alert');
  await expect(banner.getByText(BANNER)).toBeVisible();
  await expect(banner.getByRole('button', 'Dismiss notification')).toBeVisible();
  await agent.act('Click the Sign in button in the session-expired notice');
  await expect(browser).toHaveURL(/^https:\/\/accounts\.spotify\.com\/authorize\?/);
  await expect.poll(() => authorize.length).toBe(1);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Session-expired notice. Scenario: User dismisses the banner.
test('session-expired banner can be dismissed', async ({ agent, app, screen, browser }) => {
  await mockTokenEndpoints(browser, { refresh: { status: 400, json: { error: 'invalid_grant' } } });
  await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'dead-refresh', expiresInMs: 60_000 });

  await app.open('/');
  await expect(screen.getByText(BANNER)).toBeVisible();

  await agent.act('Dismiss the session-expired notice');

  await expect(screen.getByText(BANNER)).toHaveCount(0);
});

// openspec/specs/spotify-auth/spec.md
// Requirement: Sign-out. Scenario: User signs out.
test('signing out removes the session', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await seedSession(browser, { refreshToken: 'a-refresh' });
  await app.open('/');
  await expect(browser.locator('.spotify-user-name')).toHaveText('E2E Listener');
  const before = calls.length;

  await agent.act('Sign out of Spotify');

  await expect(screen.getByRole('button', 'Sign in with Spotify')).toBeVisible();
  expect(await session(browser)).toEqual([null, null, null]);
  // The requirement rules out revoking the tokens with Spotify.
  expect(calls.length).toBe(before);
});
