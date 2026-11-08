import { expect } from 'e2e';
import { test } from './fixtures.ts';
import { cardSelector, listedTitles, presetRegion, sleep, toggleName } from './helpers.ts';

const LIST = /127\.0\.0\.1:3100\/spotify\?/;

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

  await screen.getByRole('heading', 'Archived Playlists').hover();
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
  await expect(browser).toHaveClass(screen.getByRole('button', 'ALL'), /\bactive\b/);
  await expect(screen.getByText('1–5 of 64')).toBeVisible();

  // Scripted: the seed's long playlists push this control past the agent's snapshot.
  await screen.getByLabel('Per page').selectOption('10');
  await expect(screen.getByText('1–10 of 64')).toBeVisible();
  const regions = (await listedTitles(browser)).map((title) => title.split('.')[3]);
  expect(new Set(regions)).toEqual(new Set(['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU']));
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Default and remembered region. Scenario: Choice survives a reload.
test('region choice survives a reload', async ({ agent, app, screen, browser }) => {
  await app.open('/');
  await agent.act('Filter the archive to the UK region');
  await expect(screen.getByText('1–2 of 2')).toBeVisible();

  await browser.reload();

  await expect(browser).toHaveClass(screen.getByRole('button', 'UK'), /\bactive\b/);
  await expect(screen.getByText('1–2 of 2')).toBeVisible();
  expect(await listedTitles(browser)).toEqual(['New.Music.Friday.UK.02.14.2026', 'New.Music.Friday.UK.02.07.2026']);
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
test('region filter narrows the list', async ({ app, agent, screen }) => {
  await app.open('/');
  await expect(screen.getByText('1–5 of 64')).toBeVisible();

  await agent.act('Filter the archive to the DE region');

  await expect(screen.getByText('1–2 of 2')).toBeVisible();
  await agent.assert('Every listed playlist has DE in its title');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Archive filtering and order. Scenario: ALL shows newest first across regions.
test('ALL shows newest first across regions', async ({ app, screen, browser }) => {
  await app.open('/');
  // Scripted: the seed's long playlists push this control past the agent's snapshot.
  await screen.getByLabel('Per page').selectOption('10');
  await expect(screen.getByText('1–10 of 64')).toBeVisible();

  const week = (label: string, regions: string[]) => regions.map((r) => `New.Music.Friday.${r}.${label}`);
  expect(await listedTitles(browser)).toEqual([
    ...week('02.14.2026', ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU']),
    ...week('02.07.2026', ['US', 'UK', 'CA']),
  ]);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Pagination. Scenario: Default page size.
test('default page size is 5', async ({ app, screen }) => {
  await app.open('/');
  await expect(screen.getByLabel('Per page')).toHaveValue('5');
  await expect(screen.getByText('1–5 of 64')).toBeVisible();
  await expect(screen.getByRole('article')).toHaveCount(5);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Pagination. Scenario: Changing page size resets to the first page.
test('changing page size resets to the first page', async ({ agent, app, screen }) => {
  await app.open('/');
  await expect(screen.getByText('1–5 of 64')).toBeVisible();
  await agent.act('Go to the third page of playlists');
  await expect(screen.getByText('11–15 of 64')).toBeVisible();

  await screen.getByLabel('Per page').selectOption('10');

  await expect(screen.getByText('1–10 of 64')).toBeVisible();
  await expect(screen.getByRole('article')).toHaveCount(10);
  await expect(screen.getByRole('button', 'Previous page')).toBeDisabled();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Pagination. Scenario: Changing region resets to the first page.
test('changing region resets to the first page', async ({ agent, app, screen }) => {
  await app.open('/');
  await screen.getByRole('button', 'Next page').tap();
  await expect(screen.getByText('6–10 of 64')).toBeVisible();

  await agent.act('Filter the archive to the DE region');

  await expect(screen.getByText('1–2 of 2')).toBeVisible();
  await expect(screen.getByRole('article')).toHaveCount(2);
  await expect(screen.getByRole('button', 'Previous page')).toBeDisabled();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Pagination. Scenario: Navigation buttons respect the ends.
test('navigation buttons respect the ends', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'AU');
  await app.open('/');
  await screen.getByLabel('Per page').selectOption('20');
  await expect(screen.getByText('1–20 of 52')).toBeVisible();
  await expect(screen.getByRole('button', 'Previous page')).toBeDisabled();
  await expect(screen.getByRole('button', 'Next page')).toBeEnabled();

  await agent.act('Go to the last page of playlists');

  await expect(screen.getByText('41–52 of 52')).toBeVisible();
  await expect(screen.getByRole('button', 'Next page')).toBeDisabled();
  await expect(screen.getByRole('button', 'Previous page')).toBeEnabled();
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: Loading state while fetching.
test('loading state shows while fetching', async ({ app, screen, browser }) => {
  await app.open('/');
  await expect(screen.getByText('1–5 of 64')).toBeVisible();

  // Holds each request open so the spinner can't be missed, then lets it through.
  let release = () => {};
  await browser.route(LIST, async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fallback();
  });
  const expectLoadingUntilReleased = async (range: string) => {
    await expect(screen.getByText('Loading playlists...')).toBeVisible();
    await expect(browser.locator('.loading-spinner')).toBeVisible();
    await expect(browser.locator('.pagination')).toHaveCount(0);
    release();
    await expect(screen.getByText(range)).toBeVisible();
    await expect(screen.getByText('Loading playlists...')).toBeHidden();
  };

  await screen.getByRole('button', 'Next page').tap();
  await expectLoadingUntilReleased('6–10 of 64');
  await screen.getByLabel('Per page').selectOption('10');
  await expectLoadingUntilReleased('1–10 of 64');
  await screen.getByRole('button', 'UK').tap();
  await expectLoadingUntilReleased('1–2 of 2');
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: Request fails.
test('failed request shows the error state', async ({ app, screen, browser }) => {
  const message = 'Failed to load playlists. Please try again.';

  await browser.route(LIST, (route) => route.fulfill({ status: 500, json: { error: 'Internal server error' } }));
  await app.open('/');
  await expect(screen.getByText(message)).toBeVisible();
  await expect(browser.locator('.pagination')).toHaveCount(0);

  // The other half: a request that can't complete at all.
  await browser.unroute(LIST);
  await browser.route(LIST, (route) => route.abort());
  await screen.getByRole('button', 'US').tap();
  await expect(screen.getByText(message)).toBeVisible();
  await expect(browser.locator('.pagination')).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Loading, empty and error states. Scenario: No playlists match.
test('empty result shows the empty state', async ({ app, screen, browser }) => {
  await browser.route(LIST, (route) => route.fulfill({ json: { count: 0, items: [] } }));
  await app.open('/');

  await expect(screen.getByText('No playlists found')).toBeVisible();
  await expect(screen.getByText('Try selecting a different region filter.', { exact: false })).toBeVisible();
  await expect(browser.locator('.pagination')).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Playlist card content. Scenario: Card shows title, date and count.
// e2e.config.ts sets the browser's time zone to UTC, as this scenario requires.
test('card shows title, date and count', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'US');
  await app.open('/');
  const card = browser.locator(cardSelector('US'));

  await expect(card.getByRole('heading', 'New . Music . Friday . US . 02 . 14 . 2026')).toBeVisible();
  await expect(card.getByText('February 14, 2026')).toBeVisible();
  await expect(card.getByText('30 tracks')).toBeVisible();

  const codeColor = await browser.evaluate(
    (selector: string) => {
      const code = document.querySelector(`${selector} .region-accent`)!;
      return { text: code.textContent, color: getComputedStyle(code).color };
    },
    cardSelector('US'),
  );
  expect(codeColor).toEqual({ text: 'US', color: 'rgb(245, 196, 81)' });
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Playlist card expansion. Scenario: Card expands and collapses.
test('card expands and collapses', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  const head = screen.getByRole('button', toggleName('DE'));
  const tracksHeight = () =>
    browser.evaluate(
      (selector: string) => document.querySelector(`${selector} .tracks`)!.getBoundingClientRect().height,
      cardSelector('DE'),
    );
  const expectState = async (expanded: boolean) => {
    await expect(head).toHaveAttribute('aria-expanded', String(expanded));
    if (expanded) await expect.poll(tracksHeight, { timeout: 3000 }).toBeGreaterThan(100);
    else await expect.poll(tracksHeight, { timeout: 3000 }).toBe(0);
  };

  await expectState(false);
  await agent.act('Expand the DE playlist from February 14, 2026');
  await expectState(true);
  await head.tap();
  await expectState(false);

  await head.focus();
  await browser.keyboard.press('Enter');
  await expectState(true);
  await browser.keyboard.press('Enter');
  await expectState(false);

  await browser.keyboard.press('Space');
  await expectState(true);
  await browser.keyboard.press('Space');
  await expectState(false);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Playlist card expansion. Scenario: Collapsed tracks are skipped by the keyboard.
test('Tab skips the tracks of a collapsed card', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  const card = cardSelector('DE');
  const save = browser.locator(`${card} .pcard-dl`);
  // Locators still find inert content (docs/browser.mdx, "Inert content"), so ask
  // the browser whether the track controls sit under an inert subtree, which
  // takes them out of the accessibility tree.
  const tracksInert = () =>
    browser.evaluate(
      (selector: string) =>
        [...document.querySelectorAll(`${selector} .track-row, ${selector} .track-open`)].every(
          (el) => el.closest('[inert]') !== null,
        ),
      card,
    );
  await expect(save).toBeVisible();
  await expect(browser.locator('.pcard-head[aria-expanded="true"]')).toHaveCount(0);

  expect(await tracksInert()).toBe(true);
  await save.focus();
  await browser.keyboard.press('Tab');
  // The seed's other DE card is the week before.
  const focusedLabel = await browser.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  expect(focusedLabel).toBe(toggleName('DE', '02.07.2026'));

  await screen.getByRole('button', toggleName('DE')).tap();
  await expect(screen.getByRole('button', toggleName('DE'))).toHaveAttribute('aria-expanded', 'true');
  expect(await tracksInert()).toBe(false);
  await save.focus();
  await browser.keyboard.press('Tab');
  const onFirstRow = await browser.evaluate(
    (selector: string) => document.activeElement === document.querySelector(`${selector} .track-row`),
    card,
  );
  expect(onFirstRow).toBe(true);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track listing. Scenario: Long playlist shows every track.
test('long playlist shows every track', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'UK');
  await app.open('/');
  await agent.act('Expand the UK playlist from February 14, 2026');
  await expect(screen.getByRole('button', toggleName('UK'))).toHaveAttribute('aria-expanded', 'true');
  const card = cardSelector('UK');

  const numbers = await browser.locator(`${card} .track-num`).allTextContents();
  expect(numbers).toEqual(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, '0')));

  const lastRow = browser.locator(card).getByRole('button', 'Play Test Track 50 UK');
  await lastRow.scrollIntoView();
  await expect(lastRow).toBeVisible();
  // toBeVisible ignores overflow clipping, so check the row against its clip box.
  const clippedBy = () =>
    browser.evaluate((selector: string) => {
      const rows = document.querySelectorAll(`${selector} .track-row`);
      const row = rows[rows.length - 1].getBoundingClientRect();
      const clip = document.querySelector(`${selector} .tracks`)!.getBoundingClientRect();
      return row.bottom - clip.bottom;
    }, cardSelector('UK'));
  await expect.poll(clippedBy, { timeout: 3000 }).toBeLessThanOrEqual(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Preview opens and closes.
// Checks the embed element only. appHostOnly blocks its request to open.spotify.com.
test('track preview opens and closes', async ({ agent, app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await screen.getByRole('button', toggleName('DE')).tap();
  const card = cardSelector('DE');
  const row = browser.locator(`${card} .track-row`).first();
  const embed = browser.locator(`${card} iframe[title="Spotify embed: Test Track 1 DE"]`);

  await agent.act('Play the first track of the expanded playlist');

  await expect(embed).toBeAttached();
  const src = await embed.getAttribute('src');
  expect(src).toMatch(/^https:\/\/open\.spotify\.com\/embed\/track\/e2eDE02142026n1x+\?/);
  const beneathRow = await browser.evaluate(
    (selector: string) => !!document.querySelector(`${selector} .track-row`)!.nextElementSibling!.querySelector('iframe'),
    cardSelector('DE'),
  );
  expect(beneathRow).toBe(true);

  await row.tap();
  await expect(embed).toHaveCount(0);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Spotify link does not toggle preview.
test('Spotify link does not toggle the preview', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await screen.getByRole('button', toggleName('DE')).tap();
  const card = cardSelector('DE');
  const link = browser.locator(card).getByRole('link', 'Open Test Track 1 DE on Spotify');
  const embeds = browser.locator(`${card} iframe`);

  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /^https:\/\/open\.spotify\.com\/track\/e2eDE/);

  // Doesn't open one. The new tab's request to Spotify is blocked by appHostOnly.
  await link.tap();
  await expect(embeds).toHaveCount(0);

  // Doesn't close one either.
  await browser.locator(`${card} .track-row`).first().tap();
  await expect(embeds).toHaveCount(1);
  await link.tap();
  await expect(embeds).toHaveCount(1);
  await expect(browser).toHaveURL(/127\.0\.0\.1:3100\/$/);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Track preview. Scenario: Spotify link from the keyboard.
// Enter on a link fires its click, which opens the new tab. A row handler that
// cancelled the key would stop that click, so count clicks on the link.
test('Enter on the Spotify link opens it without a preview', async ({ app, screen, browser }) => {
  await presetRegion(browser, 'DE');
  await app.open('/');
  await screen.getByRole('button', toggleName('DE')).tap();
  const card = cardSelector('DE');
  const link = browser.locator(card).getByRole('link', 'Open Test Track 1 DE on Spotify');
  const embeds = browser.locator(`${card} iframe`);
  await expect(link).toBeVisible();
  await browser.evaluate(() => {
    document.body.dataset.linkClicks = '0';
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest('.track-open')) {
        document.body.dataset.linkClicks = String(Number(document.body.dataset.linkClicks) + 1);
      }
    }, true);
  });
  const linkClicks = () => browser.evaluate(() => document.body.dataset.linkClicks);

  // Doesn't open one.
  await link.focus();
  await browser.keyboard.press('Enter');
  await expect.poll(linkClicks).toBe('1');
  await expect(embeds).toHaveCount(0);

  // Doesn't close one either.
  await browser.locator(`${card} .track-row`).first().tap();
  await expect(embeds).toHaveCount(1);
  await link.focus();
  await browser.keyboard.press('Enter');
  await expect.poll(linkClicks).toBe('2');
  await expect(embeds).toHaveCount(1);
  await expect(browser).toHaveURL(/127\.0\.0\.1:3100\/$/);
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
  await sleep(300);
  const stillA = await frame();
  await sleep(500);
  expect(await frame()).toBe(stillA);

  const timings = await browser.evaluate(() => {
    const seconds = (value: string) => parseFloat(value);
    const button = getComputedStyle(document.querySelector('.region-btn')!);
    const eq = getComputedStyle(document.querySelector('.hero-eq span')!);
    return { transition: seconds(button.transitionDuration), animation: seconds(eq.animationDuration) };
  });
  expect(timings.transition).toBeLessThan(0.001);
  expect(timings.animation).toBeLessThan(0.001);
});

// openspec/specs/archive-browsing/spec.md
// Requirement: Reduced motion and pointer effects. Scenario: Touch device without fine pointer.
// The engine has no touch emulation, so this answers the app's (pointer: fine) check
// with a stub. It proves the app's branch, not how a real touch device reports itself.
test('without a fine pointer nothing tilts or parallaxes', async ({ app, browser, screen }) => {
  await browser.addInitScript(() => {
    (window as any).pointerMoveListeners = 0;
    const add = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, ...rest: any[]) => {
      if (type === 'pointermove') (window as any).pointerMoveListeners++;
      return (add as any)(type, ...rest);
    }) as typeof window.addEventListener;
  });
  const moveOverFirstCard = async () => {
    await screen.getByRole('article').first().scrollIntoView();
    await sleep(1000); // The card's entrance animation holds its transform.
    const box = (await browser.locator('.pcard').first().boundingBox())!;
    await browser.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await browser.mouse.move(box.x + box.width / 3, box.y + box.height / 3);
  };
  const state = () =>
    browser.evaluate(() => ({
      tilt: document.querySelector<HTMLElement>('.pcard')!.style.transform,
      listeners: (window as any).pointerMoveListeners as number,
    }));

  // Control: with a fine pointer, both effects are live.
  await app.open('/');
  await moveOverFirstCard();
  const fine = await state();
  expect(fine.tilt).toContain('rotateX');
  expect(fine.listeners).toBeGreaterThan(0);

  await browser.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('pointer: fine') ? ({ ...real(query), matches: false } as MediaQueryList) : real(query);
  });
  await browser.reload();
  await moveOverFirstCard();

  expect(await state()).toEqual({ tilt: '', listeners: 0 });
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
  await expect(screen.getByText('1–2 of 2')).toBeVisible();
  expect(await commands()).toEqual(onLoad);
});
