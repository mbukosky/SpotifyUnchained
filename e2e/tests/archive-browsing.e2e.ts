import { expect } from 'e2e';
import type { Browser } from '@e2e-dev/web';
import { test } from './fixtures.ts';
import {
  EDITION_INDEX,
  FEB_07,
  FEB_14,
  PANEL,
  editionId,
  editionParam,
  openEdition,
  presetRegion,
  sleep,
  tileName,
  weekTileName,
} from './helpers.ts';

// Wall numbers below come from seed.js: US has tiles for 07.10.2015, 01.23.2026,
// 02.07.2026 and 02.14.2026; AU has 53 weekly tiles from 12.20.2024; ALL has 54 weeks.

/** The header's region buttons, which an ALL panel's region buttons would otherwise shadow. */
const regionButton = (screen: any, name: string) => screen.getByRole('group', 'Region filter').getByRole('button', name);
const tiles = (browser: Browser) => browser.locator('.wall-tile');
const selectedTiles = (browser: Browser) => browser.locator('.wall-tile[aria-pressed="true"]');
const panel = (browser: Browser) => browser.locator(PANEL);
const panelRegion = (browser: Browser) => browser.locator(`${PANEL} .ep-region`);
/** Year labels of the wall's rows, top to bottom. */
const rowYears = (browser: Browser) =>
  browser.evaluate(() => [...document.querySelectorAll('.wall-row')].map((row) => row.getAttribute('aria-label')));

// openspec/specs/archive-browsing/spec.md
// Requirement: Region selector. Scenario: Selector lists every region in order.
test('selector lists every region in order', async ({ app, screen, browser }) => {
  await app.open('/');
  const buttons = screen.getByRole('group', 'Region filter').getByRole('button');

  await expect(buttons).toHaveCount(8);
  const names = ['ALL', 'US', 'UK', 'CA', 'BR', 'MX', 'DE', 'Australia & New Zealand'];
  for (const [i, name] of names.entries()) {
    await expect(buttons.nth(i)).toHaveAccessibleName(name);
  }
  await expect(browser.locator('.region-btn-flip .flip-face').first()).toHaveText('AU');
  await expect(browser).toHaveClass(screen.getByRole('button', 'ALL'), /\bactive\b/);
  await expect(browser).toHaveClass(screen.getByRole('button', 'US'), 'region-btn');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Region selector. Scenario: AU button presents both countries.
// Hover and focus only: the engine can't emulate a device without hover, which the
// touch loop needs, because (hover: none) is a media query no script can change.
test('AU button flips to NZ on hover and focus', async ({ app, screen, browser }) => {
  await app.open('/');
  const au = screen.getByRole('button', 'Australia & New Zealand');
  const flipScaleX = () =>
    browser.evaluate(() => {
      const matrix = getComputedStyle(document.querySelector('.flip')!).transform;
      return matrix === 'none' ? 1 : parseFloat(matrix.split('(')[1]);
    });

  await expect(browser.locator('.flip-back')).toHaveText('NZ');
  expect(await flipScaleX()).toBeGreaterThan(0.99);

  await au.hover();
  await expect.poll(flipScaleX, { timeout: 3000 }).toBeLessThan(-0.99);

  await screen.getByText('Every Friday, preserved.').hover();
  await expect.poll(flipScaleX, { timeout: 3000 }).toBeGreaterThan(0.99);

  // :focus-visible needs real keyboard focus, so tab to it.
  for (let i = 0; i < 12; i++) {
    await browser.keyboard.press('Tab');
    const focused = await browser.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    if (focused === 'Australia & New Zealand') break;
  }
  await expect(au).toBeFocused();
  await expect.poll(flipScaleX, { timeout: 3000 }).toBeLessThan(-0.99);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Default and remembered region. Scenario: First visit defaults to ALL.
test('first visit defaults to ALL', async ({ app, screen, browser }) => {
  await app.open('/');
  await expect(browser).toHaveClass(regionButton(screen, 'ALL'), /\bactive\b/);
  // Every region has an edition that week, so the wall is drawing all of them.
  await expect(screen.getByRole('button', weekTileName(FEB_14, 7))).toBeVisible();
  await expect(tiles(browser)).toHaveCount(54);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Default and remembered region. Scenario: Choice survives a reload.
test('region choice survives a reload', async ({ agent, app, screen, browser }) => {
  await app.open('/');
  await agent.act('Filter the archive to the UK region');
  await expect(browser).toHaveClass(regionButton(screen, 'UK'), /\bactive\b/);

  await browser.reload();

  await expect(browser).toHaveClass(regionButton(screen, 'UK'), /\bactive\b/);
  await expect(tiles(browser)).toHaveCount(2);
  await expect(screen.getByRole('button', tileName(FEB_14, 50))).toBeVisible();
  await expect(screen.getByRole('button', tileName(FEB_07, 3))).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Region accent colors. Scenario: Active region button takes its accent.
test('active region button takes its accent', async ({ agent, app, screen, browser }) => {
  const fill = (name: string) =>
    browser.evaluate((label: string) => {
      const button = [...document.querySelectorAll('.region-btn')].find((b) => b.textContent === label)!;
      return getComputedStyle(button).backgroundColor;
    }, name);

  await app.open('/');
  await expect.poll(() => fill('ALL'), { timeout: 3000 }).toBe('rgb(255, 255, 255)');

  await agent.act('Click the CA region button and do nothing else');
  await expect(browser).toHaveClass(screen.getByRole('button', 'CA'), /\bactive\b/);
  await expect.poll(() => fill('CA'), { timeout: 3000 }).toBe('rgb(255, 107, 107)');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Region accent colors. Scenario: Background follows the selected region.
test('background follows the selected region', async ({ app, screen, browser }) => {
  // Blob positions are random. Pin them so one pixel holds every blob's colour.
  await browser.addInitScript(() => {
    Math.random = () => 0.5;
  });
  const greenPerBlue = () =>
    browser.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.mesh-canvas')!;
      const x = Math.floor(canvas.width / 2);
      const y = Math.floor(canvas.height / 2);
      const [, g, b] = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data;
      return g / b;
    });

  await app.open('/');
  await sleep(500);
  const start = await greenPerBlue();

  await screen.getByRole('button', 'BR').tap();
  const justAfter = await greenPerBlue();
  await expect.poll(greenPerBlue, { timeout: 10_000 }).toBeGreaterThan(start * 1.15);
  await sleep(3000);
  const settled = await greenPerBlue();
  // Gradual: the first frames after the click are well short of where it ends up.
  expect(justAfter).toBeLessThan(settled);

  await screen.getByRole('button', 'ALL').tap();
  await expect.poll(greenPerBlue, { timeout: 10_000 }).toBeLessThan(start * 1.05);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive filtering and order. Scenario: Region filter narrows the list.
test('region filter narrows the wall', async ({ app, agent, screen, browser }) => {
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(54);

  await agent.act('Filter the archive to the DE region');

  await expect(browser).toHaveClass(regionButton(screen, 'DE'), /\bactive\b/);
  await expect(tiles(browser)).toHaveCount(2);
  // Open each tile to see which region's edition it stands for.
  for (const name of [tileName(FEB_14, 3), tileName(FEB_07, 3)]) {
    await screen.getByRole('button', name).tap();
    await expect(panelRegion(browser)).toHaveText('DE');
  }
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive filtering and order. Scenario: ALL shows newest first across regions.
test('ALL shows every week, newest year first', async ({ app, browser }) => {
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(54);

  expect(await rowYears(browser)).toEqual(['2026', '2025', '2024', '2015']);
  const perRow = await browser.evaluate(() =>
    [...document.querySelectorAll('.wall-row')].map((row) => row.querySelectorAll('.wall-tile').length),
  );
  // 2026: seven Saturday weeks to 02.14 (US 01.23 shares AU 01.24's week). 2025: AU
  // from 02.22. 2024: the AU special. 2015: the US Tuesday and Friday share one week.
  expect(perRow).toEqual([7, 45, 1, 1]);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive filtering and order. Scenario: Changing region closes another region's edition.
test('changing region closes another region\'s edition', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'UK');
  await openEdition(app, editionId('UK'));
  await expect(panelRegion(browser)).toHaveText('UK');

  await agent.act('Filter the archive to the DE region');

  await expect(browser).toHaveClass(regionButton(screen, 'DE'), /\bactive\b/);
  await expect(panel(browser)).toHaveCount(0);
  await expect(browser).toHaveURL(`${app.baseUrl}/`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: Loading state while fetching.
test('loading state shows while fetching', async ({ app, screen, browser }) => {
  // Holds the index request open so the spinner can't be missed, then lets it through.
  let release = () => {};
  await browser.route(EDITION_INDEX, async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fallback();
  });

  await app.open('/');

  await expect(screen.getByText('Loading playlists...')).toBeVisible();
  await expect(browser.locator('.loading-spinner')).toBeVisible();
  await expect(browser.locator('.wall-frame')).toHaveCount(0);
  await expect(browser.locator('.scale-headline')).toHaveCount(0);
  await expect(screen.getByText('Jump to a date')).toHaveCount(0);
  await expect(screen.getByRole('button', 'Lucky dip')).toHaveCount(0);

  release();
  await expect(screen.getByRole('button', weekTileName(FEB_14, 7))).toBeVisible();
  await expect(screen.getByText('Loading playlists...')).toBeHidden();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: Request fails.
test('failed request shows the error state', async ({ app, screen, browser }) => {
  const message = 'Failed to load playlists. Please try again.';
  const expectNoWall = async () => {
    await expect(browser.locator('.wall-frame')).toHaveCount(0);
    await expect(browser.locator('.scale-headline')).toHaveCount(0);
    await expect(screen.getByRole('button', 'Lucky dip')).toHaveCount(0);
  };

  await browser.route(EDITION_INDEX, (route) => route.fulfill({ status: 500, json: { error: 'Internal server error' } }));
  await app.open('/');
  await expect(screen.getByText(message)).toBeVisible();
  await expectNoWall();

  // The other half: a request that can't complete at all. The index is fetched once
  // per page load, so this needs a reload.
  await browser.unroute(EDITION_INDEX);
  await browser.route(EDITION_INDEX, (route) => route.abort());
  await browser.reload();
  await expect(screen.getByText(message)).toBeVisible();
  await expectNoWall();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: No playlists match.
test('empty result shows the empty state', async ({ app, screen, browser }) => {
  await browser.route(EDITION_INDEX, (route) => route.fulfill({ json: { items: [] } }));
  await app.open('/');

  await expect(screen.getByText('No playlists found')).toBeVisible();
  await expect(screen.getByText('Try selecting a different region filter.', { exact: false })).toBeVisible();
  await expect(browser.locator('.wall-frame')).toHaveCount(0);
  await expect(browser.locator('.scale-headline')).toHaveCount(0);
  await expect(screen.getByText('Jump to a date')).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive scale headline. Scenario: Headline for one region.
test('headline sums the region\'s tiles', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'AU');
  await app.open('/');

  // AU: 50 one-track weeks, 3 and 5 tracks in February 2026, and the one-track special.
  await expect(screen.getByRole('heading', '53 Fridays. 59 tracks. Since December 20, 2024.')).toBeVisible();
  await expect(screen.getByText('Every Friday, preserved.')).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive scale headline. Scenario: Headline follows the region.
test('headline follows the region', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'AU');
  await app.open('/');
  await expect(screen.getByRole('heading', '53 Fridays. 59 tracks. Since December 20, 2024.')).toBeVisible();

  await agent.act('Filter the archive to the US region');

  // US: four tiles of 4, 4, 3 and 30 tracks. The 07.07.2015 Tuesday lost its tile.
  await expect(screen.getByRole('heading', '4 Fridays. 41 tracks. Since July 10, 2015.')).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall layout. Scenario: Rows run newest first.
test('wall rows run newest year first', async ({ app, browser }) => {
  await presetRegion(browser, 'AU');
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(53);

  expect(await rowYears(browser)).toEqual(['2026', '2025', '2024']);
  const labels = await browser.locator('.wall-row .wall-year').allTextContents();
  expect(labels).toEqual(['2026', '2025', '2024']);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall layout. Scenario: Missing week leaves a gap.
// The seed's US 2026 row has 01.23 and 02.07 with nothing in the week of 01.30.
test('a missing week leaves a gap the keyboard skips', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');
  const jan23 = screen.getByRole('button', tileName('Friday, January 23, 2026', 4));
  const feb07 = screen.getByRole('button', tileName(FEB_07, 3));
  await expect(jan23).toBeVisible();

  const between = await browser.evaluate(() => {
    const tile = [...document.querySelectorAll('.wall-tile')].find((el) =>
      el.getAttribute('aria-label')!.startsWith('Friday, January 23, 2026'),
    )!;
    const gap = tile.nextElementSibling!;
    return {
      gap: gap.className,
      hidden: gap.getAttribute('aria-hidden'),
      focusable: (gap as HTMLElement).tabIndex >= 0 || gap.matches('button, a, input, [tabindex]'),
      after: gap.nextElementSibling!.getAttribute('aria-label'),
    };
  });
  expect(between).toEqual({ gap: 'wall-empty', hidden: 'true', focusable: false, after: tileName(FEB_07, 3) });

  await jan23.focus();
  await browser.keyboard.press('ArrowRight');
  await expect(feb07).toBeFocused();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall tiles. Scenario: Tile is named for its edition.
test('a tile is named for its edition', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');

  await expect(screen.getByRole('button', 'Saturday, February 14, 2026, 30 tracks')).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall tiles. Scenario: Two editions in one week.
test('two editions in one week share one tile, named for the later', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(4);

  const row2015 = browser.locator('.wall-row[aria-label="2015"] .wall-tile');
  await expect(row2015).toHaveCount(1);
  await expect(row2015).toHaveAccessibleName(tileName('Friday, July 10, 2015', 4));
  await expect(screen.getByRole('button', 'Tuesday, July 7, 2015', { exact: false })).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall keyboard navigation. Scenario: Arrow keys move between tiles.
test('arrow keys move between tiles', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');
  const feb07 = screen.getByRole('button', tileName(FEB_07, 3));
  const feb14 = screen.getByRole('button', tileName(FEB_14, 30));

  await feb07.focus();
  await browser.keyboard.press('ArrowRight');
  await expect(feb14).toBeFocused();
  await browser.keyboard.press('ArrowLeft');
  await expect(feb07).toBeFocused();

  // The requirement also has Enter and Space open the focused tile.
  await browser.keyboard.press('Enter');
  await expect(screen.getByRole('heading', FEB_07)).toBeVisible();
  await feb14.focus();
  await browser.keyboard.press('Space');
  await expect(screen.getByRole('heading', FEB_14)).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall keyboard navigation. Scenario: Tab leaves the wall.
test('Tab leaves the wall', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'AU');
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(53);
  await expect(browser.locator('.wall-tile[tabindex="0"]')).toHaveCount(1);

  await browser.locator('.wall-tile[tabindex="0"]').focus();
  await browser.keyboard.press('Tab');

  // Nothing after the wall takes focus until the footer, with no panel open.
  await expect(screen.getByRole('link', 'SpotifyUnchained on GitHub')).toBeFocused();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition panel. Scenario: Tile opens its edition.
test('a tile opens its edition', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');

  await agent.act('Open the edition from February 14, 2026');

  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(panelRegion(browser)).toHaveText('US');
  await expect.poll(() =>
    browser.evaluate((sel: string) => getComputedStyle(document.querySelector(sel)!).color, `${PANEL} .ep-region`),
  ).toBe('rgb(245, 196, 81)');
  await expect(panel(browser).getByText('30 tracks')).toBeVisible();
  await expect(screen.getByRole('button', tileName(FEB_14, 30))).toHaveAttribute('aria-pressed', 'true');
  await expect(selectedTiles(browser)).toHaveCount(1);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition panel. Scenario: Opening another edition replaces the first.
test('opening another edition replaces the first', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');
  await screen.getByRole('button', tileName(FEB_14, 30)).tap();
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();

  await agent.act('Open the edition from February 7, 2026');

  await expect(panel(browser).getByRole('heading', FEB_07)).toBeVisible();
  await expect(panel(browser)).toHaveCount(1);
  await expect(selectedTiles(browser)).toHaveCount(1);
  await expect(selectedTiles(browser)).toHaveAccessibleName(tileName(FEB_07, 3));
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition panel. Scenario: Panel closes.
test('the panel closes', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'US');
  await openEdition(app, editionId('US'));
  await expect(panel(browser)).toBeVisible();
  await expect(selectedTiles(browser)).toHaveCount(1);

  await agent.act('Close the open edition');

  await expect(panel(browser)).toHaveCount(0);
  await expect(selectedTiles(browser)).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition panel loading and failure. Scenario: Edition request fails.
test('a failed edition request leaves the wall usable', async ({ agent, app, screen, browser }) => {
  await browser.route(`**/spotify/editions/${editionId('DE')}`, (route) =>
    route.fulfill({ status: 500, json: { error: 'Internal server error' } }),
  );
  await presetRegion(browser, 'DE');
  await app.open('/');

  await agent.act(
    'Open the edition from February 14, 2026. Its tracks failing to load is the expected result',
  );

  await expect(panel(browser).getByText('Failed to load this edition. Please try again.')).toBeVisible();
  await screen.getByRole('button', tileName(FEB_07, 3)).tap();
  await expect(panel(browser).getByRole('heading', FEB_07)).toBeVisible();
  await expect(browser.locator(`${PANEL} .track-row`)).toHaveCount(3);
  await expect(panel(browser).getByText('Failed to load this edition. Please try again.')).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Displayed edition dates. Scenario: Date does not shift west of UTC.
// The tool sets the time zone per target only (web({ timezoneId })), with no
// per-test override, and e2e.config.ts pins UTC for the rest of the suite. A second
// target would run every test twice. A script can't move the browser's own zone,
// so faking one would prove nothing. wall.test.js covers the local-midnight parse.
test(
  'an edition date does not shift west of UTC',
  { skip: 'needs America/Los_Angeles; the engine sets time zones per target, not per test' },
  async () => {},
);

// openspec/specs/archive-browsing/spec.md
// Requirement: Previous and next edition. Scenario: Stepping back a week.
test('Previous edition steps back a week', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'US');
  await openEdition(app, editionId('US'));
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();

  await agent.act('Go to the previous edition');

  await expect(panel(browser).getByRole('heading', FEB_07)).toBeVisible();
  await expect(panelRegion(browser)).toHaveText('US');
  await expect(browser).toHaveURL(`${app.baseUrl}/?edition=${editionId('US', '02.07.2026')}`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Previous and next edition. Scenario: Ends are disabled.
test('the ends of a region are disabled', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await openEdition(app, editionId('US'));
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(screen.getByRole('button', 'Next edition')).toBeDisabled();
  await expect(screen.getByRole('button', 'Previous edition')).toBeEnabled();

  // The earliest is the 2015 Tuesday, which has no tile of its own.
  await openEdition(app, editionId('US', '07.07.2015'));
  await expect(panel(browser).getByRole('heading', 'Tuesday, July 7, 2015')).toBeVisible();
  await expect(screen.getByRole('button', 'Previous edition')).toBeDisabled();
  await expect(screen.getByRole('button', 'Next edition')).toBeEnabled();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition deep link. Scenario: URL follows the open edition.
test('the URL follows the open edition', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');

  await agent.act('Open the edition from February 14, 2026');

  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(browser).toHaveURL(`${app.baseUrl}/?edition=${editionId('DE')}`);

  await screen.getByRole('button', 'Close edition').tap();
  await expect(panel(browser)).toHaveCount(0);
  await expect(browser).toHaveURL(`${app.baseUrl}/`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition deep link. Scenario: Loading a link opens the edition.
test('loading a link opens the edition', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await openEdition(app, editionId('US'));

  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(panelRegion(browser)).toHaveText('US');
  await expect(screen.getByRole('button', tileName(FEB_14, 30))).toHaveAttribute('aria-pressed', 'true');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Edition deep link. Scenario: Unknown edition id.
test('an unknown edition id is dropped', async ({ app, screen, browser }) => {
  for (const id of ['e2e000000000000000000000', 'not-an-id']) {
    await app.open(`/?edition=${id}`);

    await expect(screen.getByRole('button', weekTileName(FEB_14, 7))).toBeVisible();
    await expect(browser).toHaveURL(`${app.baseUrl}/`);
    await expect(panel(browser)).toHaveCount(0);
  }
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Deep link to another region. Scenario: Link overrides the saved region for the visit.
test('a link to another region overrides the saved one for the visit', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await openEdition(app, editionId('UK'));

  await expect(browser).toHaveClass(regionButton(screen, 'UK'), /\bactive\b/);
  await expect(browser).toHaveClass(regionButton(screen, 'US'), 'region-btn');
  await expect(panelRegion(browser)).toHaveText('UK');
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(panel(browser).getByText('50 tracks')).toBeVisible();
  expect(await browser.evaluate(() => localStorage.getItem('selectedRegion'))).toBe('US');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Jump to a date. Scenario: Nearest edition opens.
// Scripted: a date field takes typed input the agent's actions don't cover.
test('jumping to a date opens the nearest edition', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');

  await screen.getByLabel('Jump to a date').fill('2026-02-12');

  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(panelRegion(browser)).toHaveText('DE');
  expect(await editionParam(browser)).toBe(editionId('DE'));
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Lucky dip. Scenario: Lucky dip opens a track.
test('Lucky dip opens a track', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(2);

  await agent.act('Click the Lucky dip button');

  await expect(panelRegion(browser)).toHaveText('DE');
  await expect(browser.locator(`${PANEL} iframe[title^="Spotify embed: "]`)).toHaveCount(1);
  await expect(browser.locator(`${PANEL} .track-row.playing-row`)).toHaveCount(1);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: All-regions wall. Scenario: Week tile counts its regions.
test('a week tile counts its regions', async ({ app, screen, browser }) => {
  await app.open('/');

  await expect(screen.getByRole('button', weekTileName(FEB_14, 7))).toBeVisible();
  const color = await browser.evaluate(() => getComputedStyle(document.querySelector('.archive-inner')!).getPropertyValue('--rc').trim());
  expect(color).toBe('#ffffff');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: All-regions wall. Scenario: Switching region inside the panel.
test('switching region inside an ALL week', async ({ agent, app, screen, browser }) => {
  await app.open('/');
  await screen.getByRole('button', weekTileName(FEB_14, 7)).tap();
  const regions = screen.getByRole('group', 'Regions archived this week').getByRole('button');
  await expect(regions).toHaveCount(7);
  expect(await regions.allTextContents()).toEqual(['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU']);
  await expect(regions.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(panelRegion(browser)).toHaveText('US');

  await agent.act('In the open edition panel, select the UK edition of this week');

  await expect(panelRegion(browser)).toHaveText('UK');
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(browser).toHaveURL(`${app.baseUrl}/?edition=${editionId('UK')}`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Wall on narrow screens. Scenario: Wall scrolls inside its container.
test('the wall scrolls inside its container on a narrow screen', async ({ app, browser }) => {
  await browser.setViewport({ width: 390, height: 844 });
  await presetRegion(browser, 'AU');
  await app.open('/');
  await expect(tiles(browser)).toHaveCount(53);
  await sleep(1000); // Let the tiles' entrance settle.

  const measure = () =>
    browser.evaluate(() => {
      const root = document.documentElement;
      const sc = document.querySelector('.wall-scroll')!;
      const box = sc.getBoundingClientRect();
      const latest = document.querySelector('.wall-tile.is-latest')!.getBoundingClientRect();
      const year = document.querySelector('.wall-row .wall-year')!.getBoundingClientRect();
      return {
        pageOverflow: root.scrollWidth - root.clientWidth,
        wallOverflow: sc.scrollWidth - sc.clientWidth,
        latestInView: latest.left >= box.left && latest.right <= box.right,
        yearInView: year.left >= box.left - 1 && year.right <= box.right,
      };
    });

  const start = await measure();
  expect(start.pageOverflow).toBeLessThanOrEqual(0);
  expect(start.wallOverflow).toBeGreaterThan(0);
  expect(start.latestInView).toBe(true);
  expect(start.yearInView).toBe(true);

  await browser.evaluate(() => {
    const sc = document.querySelector('.wall-scroll')!;
    sc.scrollLeft = sc.scrollWidth;
    return null;
  });
  const scrolled = await measure();
  expect(scrolled.pageOverflow).toBeLessThanOrEqual(0);
  expect(scrolled.yearInView).toBe(true);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track listing. Scenario: Long playlist shows every track.
test('long playlist shows every track', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'UK');
  await app.open('/');
  await agent.act('Open the edition from February 14, 2026');
  await expect(panel(browser).getByRole('heading', FEB_14)).toBeVisible();
  await expect(browser.locator(`${PANEL} .track-row`)).toHaveCount(50);

  const numbers = await browser.locator(`${PANEL} .track-num`).allTextContents();
  expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, '0')));

  const lastRow = panel(browser).getByRole('button', 'Play Test Track 50 UK');
  await lastRow.scrollIntoView();
  await expect(lastRow).toBeVisible();
  // toBeVisible ignores overflow clipping, so check the row against every clipping box above it.
  const clippedBy = () =>
    browser.evaluate((selector: string) => {
      const rows = document.querySelectorAll(`${selector} .track-row`);
      const last = rows[rows.length - 1];
      const row = last.getBoundingClientRect();
      // -1 when nothing clips: evaluate can't return -Infinity.
      let worst = -1;
      for (let el = last.parentElement; el && el !== document.body; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.overflowY === 'visible' && style.overflowX === 'visible') continue;
        worst = Math.max(worst, row.bottom - el.getBoundingClientRect().bottom);
      }
      return worst;
    }, PANEL);
  await expect.poll(clippedBy, { timeout: 3000 }).toBeLessThanOrEqual(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Preview opens and closes.
// Checks the embed element only. appHostOnly blocks its request to open.spotify.com.
test('track preview opens and closes', async ({ agent, app, browser }) => {
  await presetRegion(browser, 'DE');
  await openEdition(app, editionId('DE'));
  const row = browser.locator(`${PANEL} .track-row`).first();
  const embed = browser.locator(`${PANEL} iframe[title="Spotify embed: Test Track 1 DE"]`);
  await expect(row).toBeVisible();

  await agent.act('Play the first track of the open edition');

  await expect(embed).toBeAttached();
  const src = await embed.getAttribute('src');
  expect(src).toMatch(/^https:\/\/open\.spotify\.com\/embed\/track\/e2eDE02142026n1x+\?/);
  const beneathRow = await browser.evaluate(
    (selector: string) => !!document.querySelector(`${selector} .track-row`)!.nextElementSibling!.querySelector('iframe'),
    PANEL,
  );
  expect(beneathRow).toBe(true);

  await row.tap();
  await expect(embed).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Spotify link does not toggle preview.
test('Spotify link does not toggle the preview', async ({ app, browser }) => {
  await presetRegion(browser, 'DE');
  await openEdition(app, editionId('DE'));
  const link = browser.locator(PANEL).getByRole('link', 'Open Test Track 1 DE on Spotify');
  const embeds = browser.locator(`${PANEL} iframe`);

  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /^https:\/\/open\.spotify\.com\/track\/e2eDE/);

  // Doesn't open one. The new tab's request to Spotify is blocked by appHostOnly.
  await link.tap();
  await expect(embeds).toHaveCount(0);

  // Doesn't close one either.
  await browser.locator(`${PANEL} .track-row`).first().tap();
  await expect(embeds).toHaveCount(1);
  await link.tap();
  await expect(embeds).toHaveCount(1);
  await expect(browser).toHaveURL(`${app.baseUrl}/?edition=${editionId('DE')}`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Spotify link from the keyboard.
// Enter on a link fires its click, which opens the new tab. A row handler that
// cancelled the key would stop that click, so count clicks on the link.
test('Enter on the Spotify link opens it without a preview', async ({ app, browser }) => {
  await presetRegion(browser, 'DE');
  await openEdition(app, editionId('DE'));
  const link = browser.locator(PANEL).getByRole('link', 'Open Test Track 1 DE on Spotify');
  const embeds = browser.locator(`${PANEL} iframe`);
  await expect(link).toBeVisible();
  await browser.evaluate(() => {
    document.body.dataset.linkClicks = '0';
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest('.track-open')) {
        document.body.dataset.linkClicks = String(Number(document.body.dataset.linkClicks) + 1);
      }
    }, true);
    return null;
  });
  const linkClicks = () => browser.evaluate(() => document.body.dataset.linkClicks ?? null);

  // Doesn't open one.
  await link.focus();
  await browser.keyboard.press('Enter');
  await expect.poll(linkClicks).toBe('1');
  await expect(embeds).toHaveCount(0);

  // Doesn't close one either.
  await browser.locator(`${PANEL} .track-row`).first().tap();
  await expect(embeds).toHaveCount(1);
  await link.focus();
  await browser.keyboard.press('Enter');
  await expect.poll(linkClicks).toBe('2');
  await expect(embeds).toHaveCount(1);
  await expect(browser).toHaveURL(`${app.baseUrl}/?edition=${editionId('DE')}`);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Outbound links. Scenario: Donation and project links.
// Checks each link's target. Following one would leave the app host, which is blocked.
test('donation and project links open in a new tab', async ({ app, screen }) => {
  await app.open('/');
  const github = 'https://github.com/mbukosky/SpotifyUnchained';
  const links: Array<[string, string]> = [
    ['Donate via PayPal', 'https://paypal.me/mbukosky/1'],
    ['View on GitHub', github],
    ['☕ Buy me a coffee', 'https://ko-fi.com/A1439LK'],
    ['SpotifyUnchained on GitHub', github],
  ];
  for (const [name, href] of links) {
    const link = screen.getByRole('link', name);
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
  }
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Outbound links. Scenario: Disclaimer is visible.
test('footer disclaimer is visible', async ({ app, screen }) => {
  await app.open('/');
  const disclaimer = screen.getByText(
    'Not an official Spotify application. Built for music lovers who never want to miss a track.',
  );
  await disclaimer.scrollIntoView();
  await expect(disclaimer).toBeVisible();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Reduced motion and pointer effects. Scenario: Reduced motion requested.
test('reduced motion stills the background', async ({ app, browser }) => {
  const frame = () =>
    browser.evaluate(() => document.querySelector<HTMLCanvasElement>('canvas.mesh-canvas')!.toDataURL());

  // Control first, so a matching pair of frames below means something.
  await app.open('/');
  await sleep(300);
  const movingA = await frame();
  await sleep(500);
  expect(await frame()).not.toBe(movingA);

  await browser.emulateMedia({ reducedMotion: 'reduce' });
  await browser.reload();
  await expect(browser.locator('.wall-tile.is-latest')).toHaveCount(1);
  await sleep(300);
  const stillA = await frame();
  await sleep(500);
  expect(await frame()).toBe(stillA);

  const timings = await browser.evaluate(() => {
    const seconds = (value: string) => parseFloat(value);
    const button = getComputedStyle(document.querySelector('.region-btn')!);
    // The latest tile's pulse runs forever unless reduced motion stops it.
    const pulse = getComputedStyle(document.querySelector('.wall-tile.is-latest')!, '::before');
    return { transition: seconds(button.transitionDuration), animation: seconds(pulse.animationDuration) };
  });
  expect(timings.transition).toBeLessThan(0.001);
  expect(timings.animation).toBeLessThan(0.001);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Reduced motion and pointer effects. Scenario: Touch device without fine pointer.
// The engine has no touch emulation, so this answers the app's (pointer: fine) check
// with a stub. It proves the app's branch, not how a real touch device reports itself.
test('without a fine pointer nothing ripples or parallaxes', async ({ app, browser }) => {
  await browser.addInitScript(() => {
    (window as any).pointerMoveListeners = 0;
    const add = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, ...rest: any[]) => {
      if (type === 'pointermove') (window as any).pointerMoveListeners++;
      return (add as any)(type, ...rest);
    }) as typeof window.addEventListener;
  });
  // A tile in the middle of the 2025 row, so it has neighbours to lift on every side.
  const tile = browser.locator('.wall-row[aria-label="2025"] .wall-tile').nth(20);
  const moveOverTile = async () => {
    await tile.scrollIntoView();
    await sleep(1000); // The tiles' entrance animation holds their transform.
    const box = (await tile.boundingBox())!;
    await browser.mouse.move(box.x - 40, box.y - 40);
    await browser.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  };
  const state = () =>
    browser.evaluate(() => ({
      lifted: document.querySelectorAll('.wall-tile[style*="--lift"]').length,
      listeners: (window as any).pointerMoveListeners as number,
    }));

  // Control: with a fine pointer, both effects are live.
  await app.open('/');
  await moveOverTile();
  const fine = await state();
  expect(fine.lifted).toBeGreaterThan(0);
  expect(fine.listeners).toBeGreaterThan(0);

  await browser.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('pointer: fine') ? ({ ...real(query), matches: false } as MediaQueryList) : real(query);
  });
  await browser.reload();
  await moveOverTile();

  expect(await state()).toEqual({ lifted: 0, listeners: 0 });
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Analytics. Scenario: Page load is tagged.
// The tag's request is answered here with an empty script, so it never reaches Google.
test('page load is tagged', async ({ agent, app, screen, browser }) => {
  const tagRequests: string[] = [];
  await browser.route('https://www.googletagmanager.com/**', async (route) => {
    tagRequests.push(route.request.url);
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  const commands = () =>
    browser.evaluate(() =>
      ((window as any).dataLayer as IArguments[]).map((args) => {
        const [command, value] = Array.from(args);
        return command === 'js' ? ['js'] : [command, value];
      }),
    );

  await app.open('/');
  await expect.poll(() => tagRequests.length).toBeGreaterThan(0);

  expect(new URL(tagRequests[0]).searchParams.get('id')).toBe('G-4WWQ1NYF17');
  const onLoad = [['js'], ['config', 'G-4WWQ1NYF17']];
  expect(await commands()).toEqual(onLoad);

  // The requirement also rules out custom events from the archive page.
  await agent.act('Filter the archive to the UK region');
  await expect(browser).toHaveClass(regionButton(screen, 'UK'), /\bactive\b/);
  expect(await commands()).toEqual(onLoad);
});
