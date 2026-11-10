import { expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { test } from './fixtures.ts';
import {
  FEB_07,
  FEB_14,
  PANEL,
  editionId,
  mockAuthorize,
  mockSpotifyApi,
  openEdition,
  presetRegion,
  saveCalls,
  seedSession,
  sessionValue,
  sleep,
} from './helpers.ts';

const trackUris = (region: string, label: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const id = `e2e${region}${label.replace(/\./g, '')}n${i + 1}xxxxxxxxxxxxxxxxxxxxxx`.slice(0, 22);
    return `spotify:track:${id}`;
  });

const SAVE_AT_END = 'Click the "Save to Spotify" button at the end of the open edition\'s track list';
const TO_SIGN_IN = 'You are signed out, so being sent to a Spotify authorize page is the expected result';
const AT_SPOTIFY = /^https:\/\/accounts\.spotify\.com\/authorize\?/;

/** The save button at the end of the open edition's track list. */
const bottomSave = (browser: Browser) => browser.locator(`${PANEL} .save-btn`);
/** The save button in the edition panel's header. */
const headerSave = (browser: Browser) => browser.locator(`${PANEL} .pcard-dl`);

/** Opens a region's 02.14.2026 edition signed in, and waits for the profile and the tracks. */
async function openSignedIn(
  browser: Browser,
  app: { open: (path: string) => Promise<unknown> },
  region: string,
  { label = '02.14.2026', waitForProfile = true } = {},
) {
  await presetRegion(browser, region);
  await seedSession(browser);
  await openEdition(app, editionId(region, label));
  if (waitForProfile) await expect(browser.locator('.spotify-user-name')).toHaveText('E2E Listener');
  await expect(bottomSave(browser)).toBeVisible();
}

/** What the panel shows: its title and the URL's edition, to check it stayed put. */
const panelState = async (browser: Browser) => ({
  title: await browser.locator(`${PANEL} .ep-title`).textContent(),
  url: await browser.url(),
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save button at the end of the expanded track list. Scenario: Expanded card shows the save button.
test('an open edition ends with the save button', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await agent.act('Open the edition from February 14, 2026');

  const save = bottomSave(browser);
  await expect(save).toBeVisible();
  await expect(save).toHaveText('Save to Spotify');
  await expect(save).toHaveAccessibleName('Save playlist to Spotify');
  const isLast = await browser.evaluate((selector: string) => {
    const list = document.querySelector(`${selector} .ep-tracks`)!;
    return !!list.lastElementChild!.querySelector('.save-btn');
  }, PANEL);
  expect(isLast).toBe(true);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Signed-out save starts sign-in. Scenario: Save clicked while signed out.
test('save while signed out starts sign-in', async ({ agent, app, browser }) => {
  const authorize = await mockAuthorize(browser);
  const calls = await mockSpotifyApi(browser);
  await presetRegion(browser, 'DE');
  await openEdition(app, editionId('DE'));
  await expect(bottomSave(browser)).toBeVisible();

  await agent.act(`${SAVE_AT_END}. ${TO_SIGN_IN}`);
  await expect(browser).toHaveURL(AT_SPOTIFY);

  await expect.poll(() => authorize.length).toBe(1);
  expect(authorize[0]).toContain('https://accounts.spotify.com/authorize?');
  expect(calls).toEqual([]);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Playlist name derived from the archive title. Scenario: Dotted archive title.
test('saved playlist is named from the archive title', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'US');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  expect(saveCalls(calls)[0].body.name).toBe('New Music Friday US 02 14 2026');
});

// openspec/specs/playlist-export/spec.md
// Requirement: Saved playlists are private and owned by the signed-in user. Scenario: Playlist creation request.
test('playlist is created private before any track is added', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  const [create, ...rest] = saveCalls(calls);
  expect(create.path).toBe('/users/e2e-user/playlists');
  expect(create.body).toEqual({ name: 'New Music Friday DE 02 14 2026', public: false });
  expect(rest.map((call) => call.path)).toEqual(['/playlists/e2e-playlist/tracks']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Account id lookup for the expanded-card save. Scenario: Cached profile unavailable.
test('save looks the account id up when no profile is cached', async ({ agent, app, browser }) => {
  // The sign-in lookup and its one retry fail, which leaves no cached profile.
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.path === '/me' && all.filter((c) => c.path === '/me').length <= 2) return { status: 500 };
    if (call.path === '/me') return { status: 200, json: { id: 'looked-up-user', display_name: 'Later' } };
  });
  await openSignedIn(browser, app, 'DE', { waitForProfile: false });
  await expect(browser.locator('.spotify-user-name')).toHaveText('User');
  await expect.poll(() => calls.length, { timeout: 4000 }).toBe(2);

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  expect(calls.slice(2).map((c) => `${c.method} ${c.path}`).slice(0, 2)).toEqual([
    'GET /me',
    'POST /users/looked-up-user/playlists',
  ]);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save sends only valid track URIs. Scenario: Archive with some malformed entries.
test('save sends only the valid track URIs', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'BR');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  const uris = trackUris('BR', '02.14.2026', 3);
  expect(saveCalls(calls)[1].body).toEqual({ uris: [uris[0], uris[2]] });
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save sends only valid track URIs. Scenario: Archive with no valid URIs.
test('save with no valid URIs reports it and calls nothing', async ({ app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'MX');
  const before = calls.length;

  await bottomSave(browser).tap();

  await expect(browser.locator(`${PANEL} .save-error`)).toHaveText('This archive has no saveable tracks.');
  expect(calls.length).toBe(before);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Tracks are added in batches of up to 100. Scenario: More than 100 tracks.
test('tracks are added in batches of 100', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'CA');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  const batches = saveCalls(calls).slice(1);
  expect(batches.map((call) => call.path)).toEqual(Array(3).fill('/playlists/e2e-playlist/tracks'));
  expect(batches.map((call) => call.body.uris.length)).toEqual([100, 100, 50]);
  expect(batches.flatMap((call) => call.body.uris)).toEqual(trackUris('CA', '02.14.2026', 250));
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save button states. Scenario: Successful save.
test('successful save leaves the button disabled on Saved!', async ({ agent, app, browser }) => {
  await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!');
  await expect(bottomSave(browser)).toBeDisabled();
});

// openspec/specs/playlist-export/spec.md
// Requirement: Expanded-card save button states. Scenario: Failed save reverts after six seconds.
test('failed save shows the error, then reverts after six seconds', async ({ app, browser }) => {
  await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 403, json: { error: { message: 'Forbidden' } } };
  });
  await openSignedIn(browser, app, 'DE');
  const save = bottomSave(browser);
  const alert = browser.locator(`${PANEL} [role="alert"]`);
  await save.tap();

  await expect(save).toHaveText('Error');
  await expect(save).toBeEnabled();
  await expect(alert).toHaveText('Spotify denied the request. Sign in again to grant playlist access.');
  // toBeVisible ignores overflow clipping, so measure how much of the alert any clipping box above it cuts off.
  await sleep(800);
  const cutOff = await browser.evaluate((selector: string) => {
    const alertEl = document.querySelector(`${selector} [role="alert"]`)!;
    const bottom = alertEl.getBoundingClientRect().bottom;
    // -1 when nothing clips: evaluate can't return -Infinity.
    let worst = -1;
    for (let el = alertEl.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.overflowY === 'visible' && style.overflowX === 'visible') continue;
      worst = Math.max(worst, bottom - el.getBoundingClientRect().bottom);
    }
    return worst;
  }, PANEL);
  expect.soft(cutOff).toBeLessThanOrEqual(0);

  await expect(save).toHaveText('Save to Spotify', { timeout: 7000 });
  await expect(alert).toHaveCount(0);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Error messages for the expanded-card save. Scenario: Rate limited after retries.
test('still rate limited after retries shows the busy message', async ({ app, browser }) => {
  const calls = await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 429, headers: { 'retry-after': '1' } };
  });
  await openSignedIn(browser, app, 'DE');

  await bottomSave(browser).tap();

  await expect(browser.locator(`${PANEL} .save-error`)).toHaveText(
    'Spotify is busy right now. Try again in a minute.',
    { timeout: 10_000 },
  );
  // The first try and two retries.
  expect(saveCalls(calls).length).toBe(3);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Rate-limit retries for Spotify requests. Scenario: Retry-After honoured.
test('Retry-After is honoured and the save completes', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.method === 'POST' && saveCalls(all).length === 1) return { status: 429, headers: { 'retry-after': '1' } };
  });
  await openSignedIn(browser, app, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!', { timeout: 10_000 });
  const [first, second] = saveCalls(calls);
  expect(second.path).toBe(first.path);
  expect(second.at - first.at).toBeGreaterThanOrEqual(900);
  expect(second.at - first.at).toBeLessThan(3000);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Rate-limit retries for Spotify requests. Scenario: Retry-After capped.
test('Retry-After is capped at ten seconds', async ({ agent, app, browser }) => {
  const calls = await mockSpotifyApi(browser, (call, all) => {
    if (call.method === 'POST' && saveCalls(all).length === 1) return { status: 429, headers: { 'retry-after': '60' } };
  });
  await openSignedIn(browser, app, 'DE');

  await agent.act(SAVE_AT_END);

  await expect(bottomSave(browser)).toHaveText('Saved!', { timeout: 20_000 });
  const [first, second] = saveCalls(calls);
  expect(second.at - first.at).toBeGreaterThanOrEqual(9500);
  expect(second.at - first.at).toBeLessThan(13_000);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save clicked while signed out.
test('header save while signed out starts sign-in and keeps the edition open', async ({ agent, app, browser }) => {
  const authorize = await mockAuthorize(browser);
  await presetRegion(browser, 'DE');
  // The redirect replaces the page, so note what the panel shows as the page goes.
  await browser.addInitScript(() => {
    addEventListener('pagehide', () => {
      const title = document.querySelector('.edition-panel .ep-title');
      sessionStorage.setItem('e2e_panel', title ? `${title.textContent} ${location.search}` : 'closed');
    });
  });
  await openEdition(app, editionId('DE'));
  await expect(headerSave(browser)).toBeVisible();

  await agent.act(`Click the save button in the header of the open edition panel. ${TO_SIGN_IN}`);
  await expect(browser).toHaveURL(AT_SPOTIFY);

  await expect.poll(() => authorize.length).toBe(1);
  await browser.back();
  expect(await sessionValue(browser, 'e2e_panel')).toBe(`${FEB_14} ?edition=${editionId('DE')}`);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save from the keyboard.
// Enter on one DE edition and Space on the other, since a saved button stays disabled.
test('Enter or Space on the header save button saves and keeps the edition open', async ({ app, browser }) => {
  const calls = await mockSpotifyApi(browser);

  for (const [label, key, title] of [['02.14.2026', 'Enter', FEB_14], ['02.07.2026', 'Space', FEB_07]] as const) {
    await openSignedIn(browser, app, 'DE', { label });
    const before = await panelState(browser);
    expect(before.title).toBe(title);
    const save = headerSave(browser);
    await save.focus();
    await browser.keyboard.press(key);

    await expect(browser).toHaveClass(save, 'pcard-dl success');
    expect(await panelState(browser)).toEqual(before);
  }

  const names = saveCalls(calls)
    .map((call) => call.body?.name)
    .filter(Boolean);
  expect(names).toEqual(['New Music Friday DE 02 14 2026', 'New Music Friday DE 02 07 2026']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save succeeds.
test('header save succeeds with a check mark', async ({ app, browser }) => {
  const calls = await mockSpotifyApi(browser);
  await openSignedIn(browser, app, 'BR');
  const save = headerSave(browser);
  const before = await panelState(browser);

  await save.tap();

  await expect(browser).toHaveClass(save, 'pcard-dl success');
  await expect(save).toBeDisabled();
  await expect(browser.locator(`${PANEL} .pcard-dl polyline`)).toHaveAttribute('points', '20 6 9 17 4 12');
  expect(await panelState(browser)).toEqual(before);

  // Unlike the bottom button, this one drops empty URIs but doesn't check the format.
  const [create, add] = saveCalls(calls);
  expect(create.body).toEqual({ name: 'New Music Friday BR 02 14 2026', public: false });
  const valid = trackUris('BR', '02.14.2026', 3);
  expect(add.body.uris).toEqual([valid[0], valid[2], 'spotify:track:short', 'not-a-uri']);
});

// openspec/specs/playlist-export/spec.md
// Requirement: Save from the card header. Scenario: Header save fails.
test('header save failure shows an icon, then returns to idle', async ({ app, browser }) => {
  await mockSpotifyApi(browser, (call) => {
    if (call.method === 'POST') return { status: 500, json: { error: { message: 'Nope' } } };
  });
  await openSignedIn(browser, app, 'DE');
  const save = headerSave(browser);

  await save.tap();

  await expect(browser).toHaveClass(save, 'pcard-dl error');
  await expect(browser.locator(`${PANEL} .pcard-dl circle`)).toBeAttached();
  await expect(browser.locator(`${PANEL} [role="alert"]`)).toHaveCount(0);
  await expect(headerSave(browser)).toHaveText('');

  await expect(browser).toHaveClass(save, 'pcard-dl idle', { timeout: 4000 });
});
