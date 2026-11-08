import { expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { test } from './fixtures.ts';
import {
  cardSelector,
  mockAuthorize,
  mockSpotifyApi,
  presetRegion,
  saveCalls,
  seedSession,
  sessionValue,
  sleep,
  toggleName,
} from './helpers.ts';

const trackUris = (region: string, label: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const id = `e2e${region}${label.replace(/\./g, '')}n${i + 1}xxxxxxxxxxxxxxxxxxxxxx`.slice(0, 22);
    return `spotify:track:${id}`;
  });

const SAVE_AT_END = 'Click the "Save to Spotify" button at the end of the expanded playlist\'s track list';
const TO_SIGN_IN = 'You are signed out, so being sent to a Spotify authorize page is the expected result';
const AT_SPOTIFY = /^https:\/\/accounts\.spotify\.com\/authorize\?/;

/** The save button at the end of an expanded card. */
const bottomSave = (browser: Browser, region: string) => browser.locator(`${cardSelector(region)} .save-btn`);
/** The save button in a card header. */
const headerSave = (browser: Browser, region: string) => browser.locator(`${cardSelector(region)} .pcard-dl`);

/** Opens a region signed in, waits for the profile, and expands its newest card. */
async function openSignedIn(
  browser: Browser,
  open: () => Promise<unknown>,
  screen: any,
  region: string,
  { expand = true, waitForProfile = true } = {},
) {
  await presetRegion(browser, region);
  await seedSession(browser);
  await open();
  if (waitForProfile) await expect(browser.locator('.spotify-user-name')).toHaveText('E2E Listener');
  if (expand) await screen.getByRole('button', toggleName(region)).tap();
}

// openspec/specs/playlist-export/spec.md
// Requirement: Save button at the end of the expanded track list. Scenario: Expanded card shows the save button.
test('expanded card ends with the save button', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await agent.act('Expand the DE playlist from February 14, 2026');

  const save = bottomSave(browser, 'DE');
  await expect(save).toBeVisible();
  await expect(save).toHaveText('Save to Spotify');
  await expect(save).toHaveAccessibleName('Save playlist to Spotify');
  const isLast = await browser.evaluate(
    (selector: string) => {
      const list = document.querySelector(`${selector} .tracks-inner`)!;
      return !!list.lastElementChild!.querySelector('.save-btn');
    },
    cardSelector('DE'),
  );
  expect(isLast).toBe(true);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Signed-out save starts sign-in. Scenario: Save clicked while signed out.
test('save while signed out starts sign-in', async ({ agent, app, screen, browser }) => {
  const authorize = await mockAuthorize(browser);
  const calls = await mockSpotifyApi(browser);
  await presetRegion(browser, 'DE');
  await app.open('/');
  await screen.getByRole('button', toggleName('DE')).tap();

  await agent.act(`${SAVE_AT_END}. ${TO_SIGN_IN}`);
  await expect(browser).toHaveURL(AT_SPOTIFY);

  await expect.poll(() => authorize.length).toBe(1);
  expect(authorize[0]).toContain('https://accounts.spotify.com/authorize?');
  expect(calls).toEqual([]);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Playlist name derived from the archive title. Scenario: Dotted archive title.
test('saved playlist is named from the archive title', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'US');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'US')).toHaveText('Saved!');
  expect(saveCalls(calls)[0].body.name).toBe('New Music Friday US 02 14 2026');
});

// openspec/specs/playlist-export/spec.md
// Requirement: Saved playlists are private and owned by the signed-in user. Scenario: Playlist creation request.
test('playlist is created private before any track is added', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'DE')).toHaveText('Saved!');
  const [create, ...rest] = saveCalls(calls);
  expect(create.path).toBe('/users/e2e-user/playlists');
  expect(create.body).toEqual({ name: 'New Music Friday DE 02 14 2026', public: false });
  expect(rest.map((call) => call.path)).toEqual(['/playlists/e2e-playlist/tracks']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Account id lookup for the expanded-card save. Scenario: Cached profile unavailable.
test('save looks the account id up when no profile is cached', async ({ agent, app, screen, browser }) => {
  // The sign-in lookup and its one retry fail, which leaves no cached profile.
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.path === '/me' && all.filter((c) => c.path === '/me').length <= 2) return { status: 500 };
    if (call.path === '/me') return { status: 200, json: { id: 'looked-up-user', display_name: 'Later' } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE', { waitForProfile: false });
  await expect(browser.locator('.spotify-user-name')).toHaveText('User');
  await expect.poll(() => calls.length, { timeout: 4000 }).toBe(2);

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'DE')).toHaveText('Saved!');
  expect(calls.slice(2).map((c) => `${c.method} ${c.path}`).slice(0, 2)).toEqual([
    'GET /me',
    'POST /users/looked-up-user/playlists',
  ]);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save sends only valid track URIs. Scenario: Archive with some malformed entries.
test('save sends only the valid track URIs', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'BR');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'BR')).toHaveText('Saved!');
  const uris = trackUris('BR', '02.14.2026', 3);
  expect(saveCalls(calls)[1].body).toEqual({ uris: [uris[0], uris[2]] });
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save sends only valid track URIs. Scenario: Archive with no valid URIs.
test('save with no valid URIs reports it and calls nothing', async ({ app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'MX');
  const before = calls.length;

  await bottomSave(browser, 'MX').tap();

  await expect(browser.locator(`${cardSelector('MX')} .save-error`)).toHaveText('This archive has no saveable tracks.');
  expect(calls.length).toBe(before);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Tracks are added in batches of up to 100. Scenario: More than 100 tracks.
test('tracks are added in batches of 100', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'CA');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'CA')).toHaveText('Saved!');
  const batches = saveCalls(calls).slice(1);
  expect(batches.map((call) => call.path)).toEqual(Array(3).fill('/playlists/e2e-playlist/tracks'));
  expect(batches.map((call) => call.body.uris.length)).toEqual([100, 100, 50]);
  expect(batches.flatMap((call) => call.body.uris)).toEqual(trackUris('CA', '02.14.2026', 250));
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save button states. Scenario: Successful save.
test('successful save leaves the button disabled on Saved!', async ({ agent, app, screen, browser }) => {
  await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'DE')).toHaveText('Saved!');
  await expect(bottomSave(browser, 'DE')).toBeDisabled();
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save button states. Scenario: Failed save reverts after six seconds.
test('failed save shows the error, then reverts after six seconds', async ({ app, screen, browser }) => {
  await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 403, json: { error: { message: 'Forbidden' } } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');
  const save = bottomSave(browser, 'DE');
  const alert = browser.locator(`${cardSelector('DE')} [role="alert"]`);
  await expect.poll(
    () =>
      browser.evaluate((selector: string) => {
        const clip = document.querySelector(`${selector} .tracks`)!.getBoundingClientRect();
        const button = document.querySelector(`${selector} .save-btn`)!.getBoundingClientRect();
        return clip.bottom - button.bottom;
      }, cardSelector('DE')),
    { timeout: 3000 },
  ).toBeGreaterThan(0);

  await save.tap();

  await expect(save).toHaveText('Error');
  await expect(save).toBeEnabled();
  await expect(alert).toHaveText('Spotify denied the request. Sign in again to grant playlist access.');
  // toBeVisible ignores overflow clipping, so measure how much of the alert is cut off.
  await sleep(800);
  const cutOff = await browser.evaluate((selector: string) => {
    const alertBox = document.querySelector(`${selector} [role="alert"]`)!.getBoundingClientRect();
    const clip = document.querySelector(`${selector} .tracks`)!.getBoundingClientRect();
    return alertBox.bottom - clip.bottom;
  }, cardSelector('DE'));
  expect.soft(cutOff).toBeLessThanOrEqual(0);

  await expect(save).toHaveText('Save to Spotify', { timeout: 7000 });
  await expect(alert).toHaveCount(0);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Error messages for the expanded-card save. Scenario: Rate limited after retries.
test('still rate limited after retries shows the busy message', async ({ app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 429, headers: { 'retry-after': '1' } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');

  await bottomSave(browser, 'DE').tap();

  await expect(browser.locator(`${cardSelector('DE')} .save-error`)).toHaveText(
    'Spotify is busy right now. Try again in a minute.',
    { timeout: 10_000 },
  );
  // The first try and two retries.
  expect(saveCalls(calls).length).toBe(3);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Rate-limit retries for Spotify requests. Scenario: Retry-After honoured.
test('Retry-After is honoured and the save completes', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.method === 'POST' && saveCalls(all).length === 1) return { status: 429, headers: { 'retry-after': '1' } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'DE')).toHaveText('Saved!', { timeout: 10_000 });
  const [first, second] = saveCalls(calls);
  expect(second.path).toBe(first.path);
  expect(second.at - first.at).toBeGreaterThanOrEqual(900);
  expect(second.at - first.at).toBeLessThan(3000);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Rate-limit retries for Spotify requests. Scenario: Retry-After capped.
test('Retry-After is capped at ten seconds', async ({ agent, app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.method === 'POST' && saveCalls(all).length === 1) return { status: 429, headers: { 'retry-after': '60' } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser, 'DE')).toHaveText('Saved!', { timeout: 20_000 });
  const [first, second] = saveCalls(calls);
  expect(second.at - first.at).toBeGreaterThanOrEqual(9500);
  expect(second.at - first.at).toBeLessThan(13_000);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save clicked while signed out.
test('header save while signed out starts sign-in without toggling the card', async ({ agent, app, screen, browser }) => {
  const authorize = await mockAuthorize(browser);
  await presetRegion(browser, 'DE');
  // The redirect replaces the page, so note the card's state as the page goes.
  await browser.addInitScript(() => {
    addEventListener('pagehide', () => {
      const head = document.querySelector('.pcard-head');
      if (head) sessionStorage.setItem('e2e_expanded', String(head.getAttribute('aria-expanded')));
    });
  });
  await app.open('/');

  await agent.act(`Click the save button in the header of the DE playlist from February 14, 2026. ${TO_SIGN_IN}`);
  await expect(browser).toHaveURL(AT_SPOTIFY);

  await expect.poll(() => authorize.length).toBe(1);
  await browser.back();
  expect(await sessionValue(browser, 'e2e_expanded')).toBe('false');
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save from the keyboard.
// Enter on one DE card and Space on the other, since a saved button stays disabled.
test('Enter or Space on the header save button saves without toggling the card', async ({ app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'DE', { expand: false });

  for (const [label, key] of [['02.14.2026', 'Enter'], ['02.07.2026', 'Space']] as const) {
    const save = browser.locator(`${cardSelector('DE', label)} .pcard-dl`);
    await save.focus();
    await browser.keyboard.press(key);

    await expect(browser).toHaveClass(save, 'pcard-dl success');
    await expect(screen.getByRole('button', toggleName('DE', label))).toHaveAttribute('aria-expanded', 'false');
  }

  const names = saveCalls(calls)
    .map((call) => call.body?.name)
    .filter(Boolean);
  expect(names).toEqual(['New Music Friday DE 02 14 2026', 'New Music Friday DE 02 07 2026']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save succeeds.
test('header save succeeds with a check mark', async ({ app, screen, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, () => app.open('/'), screen, 'BR', { expand: false });
  const save = headerSave(browser, 'BR');

  await save.tap();

  await expect(browser).toHaveClass(save, 'pcard-dl success');
  await expect(save).toBeDisabled();
  await expect(browser.locator(`${cardSelector('BR')} .pcard-dl polyline`)).toHaveAttribute('points', '20 6 9 17 4 12');
  await expect(screen.getByRole('button', toggleName('BR'))).toHaveAttribute('aria-expanded', 'false');

  // Unlike the bottom button, this one drops empty URIs but doesn't check the format.
  const [create, add] = saveCalls(calls);
  expect(create.body).toEqual({ name: 'New Music Friday BR 02 14 2026', public: false });
  const valid = trackUris('BR', '02.14.2026', 3);
  expect(add.body.uris).toEqual([valid[0], valid[2], 'spotify:track:short', 'not-a-uri']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save fails.
test('header save failure shows an icon, then returns to idle', async ({ app, screen, browser }) => {
  await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 500, json: { error: { message: 'Nope' } } };
  });
  await openSignedIn(browser, () => app.open('/'), screen, 'DE', { expand: false });
  const save = headerSave(browser, 'DE');

  await save.tap();

  await expect(browser).toHaveClass(save, 'pcard-dl error');
  await expect(browser.locator(`${cardSelector('DE')} .pcard-dl circle`)).toBeAttached();
  await expect(browser.locator(`${cardSelector('DE')} [role="alert"]`)).toHaveCount(0);
  await expect(browser.locator(`${cardSelector('DE')} .pcard-dl`)).toHaveText('');

  await expect(browser).toHaveClass(save, 'pcard-dl idle', { timeout: 4000 });
});
