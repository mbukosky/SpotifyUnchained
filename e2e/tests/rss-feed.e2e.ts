import { expect } from 'e2e';
import { test } from './fixtures.ts';
import { asClient } from './helpers.ts';

const SITE = 'https://spotifyunchained.com';

// Their own client address, so these checks don't use up the browser tests' request budget.
const get = (url: string) => fetch(url, { headers: asClient('203.0.113.11') });

/** The text of each `<item>` in the feed, in order. */
const itemsOf = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
const titlesOf = (xml: string) => itemsOf(xml).map((item) => tag(item, 'title')!);
/** Everything before the first item: the channel's own fields. */
const channelOf = (xml: string) => xml.split('<item>')[0];
const regionsOf = (xml: string) => new Set(titlesOf(xml).map((title) => title.split('.')[3]));

// openspec/specs/rss-feed/spec.md
// Requirement: Feed response format and caching. Scenario: Successful feed request.
test('feed responds as a cacheable RSS 2.0 document', async ({ app }) => {
  const response = await get(`${app.baseUrl}/rss`);
  const xml = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<rss version="2.0">');
  expect(xml.match(/<channel>/g)).toHaveLength(1);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Region filtering. Scenario: Valid region filter.
test('feed filters to a valid region', async ({ app }) => {
  const xml = await (await get(`${app.baseUrl}/rss?region=UK`)).text();

  expect(titlesOf(xml)).toEqual(['New.Music.Friday.UK.02.14.2026', 'New.Music.Friday.UK.02.07.2026']);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Region filtering. Scenario: Invalid region value is ignored.
test('feed ignores an invalid region', async ({ app }) => {
  const response = await get(`${app.baseUrl}/rss?region=INVALID`);

  expect(response.status).toBe(200);
  expect(regionsOf(await response.text()).size).toBe(7);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Region filtering. Scenario: Lowercase region code is not normalized.
test('feed does not normalize a lowercase region', async ({ app }) => {
  const xml = await (await get(`${app.baseUrl}/rss?region=us`)).text();

  expect(regionsOf(xml).size).toBe(7);
  expect(tag(channelOf(xml), 'title')).toBe('Spotify Unchained — New Music Friday (All Regions)');
});

// openspec/specs/rss-feed/spec.md
// Requirement: Channel metadata. Scenario: Region-specific channel title.
test('region feed names its region in the channel', async ({ app }) => {
  const channel = channelOf(await (await get(`${app.baseUrl}/rss?region=AU`)).text());

  expect(tag(channel, 'title')).toBe('Spotify Unchained — New Music Friday (AU)');
  // The apostrophe is XML-escaped, as the escaping requirement says it must be.
  expect(tag(channel, 'description')).toBe('Weekly archive of Spotify&apos;s New Music Friday playlist (AU)');
});

// openspec/specs/rss-feed/spec.md
// Requirement: Channel metadata. Scenario: Unfiltered channel title.
test('unfiltered feed names all regions in the channel', async ({ app }) => {
  const channel = channelOf(await (await get(`${app.baseUrl}/rss`)).text());

  expect(tag(channel, 'title')).toBe('Spotify Unchained — New Music Friday (All Regions)');
  expect(tag(channel, 'link')).toBe(SITE);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Item selection and ordering. Scenario: More than 50 archived playlists.
test('feed caps at the 50 most recent playlists', async ({ app }) => {
  // AU has 52 archived weeks, so the two oldest must drop off.
  const xml = await (await get(`${app.baseUrl}/rss?region=AU`)).text();
  const dates = itemsOf(xml).map((item) => Date.parse(tag(item, 'pubDate')!));

  expect(dates).toHaveLength(50);
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  expect(new Date(dates[0]).toISOString()).toBe('2026-02-14T00:00:00.000Z');
  // 02.14 and 02.07, then 48 more weeks back from 02.07.
  const week = 7 * 24 * 60 * 60 * 1000;
  expect(dates[49]).toBe(Date.parse('2026-02-07T00:00:00Z') - 48 * week);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Item fields. Scenario: Playlist with tracks.
test('feed item holds the playlist fields and tracks', async ({ app }) => {
  const xml = await (await get(`${app.baseUrl}/rss?region=AU`)).text();
  const item = itemsOf(xml).find((text) => tag(text, 'title') === 'New.Music.Friday.AU.02.07.2026')!;
  const description = tag(item, 'description')!;

  expect(tag(item, 'link')).toBe(SITE);
  expect(tag(item, 'pubDate')).toBe('Sat, 07 Feb 2026 00:00:00 GMT');
  expect(description.startsWith('<![CDATA[<ul>')).toBe(true);
  expect(description).toContain('<li><a href="https://open.spotify.com/track/123">Test Track &mdash; Test Artist</a></li>');

  const names = [...description.matchAll(/<li><a href="[^"]*">(.*?) &mdash;/g)].map((match) => match[1]);
  expect(names).toEqual([
    'Test Track 1 AU',
    'Test Track 2 AU',
    'Test Track 3 AU',
    'Test Track',
    'Rock &amp; Roll &lt;Live&gt;',
  ]);
});

// openspec/specs/rss-feed/spec.md
// Requirement: Item fields. Scenario: Playlist identifier as guid.
test('feed item guid is the playlist permalink', async ({ app }) => {
  const { items } = await (await get(`${app.baseUrl}/spotify?region=DE&sort=desc&size=1`)).json();
  const xml = await (await get(`${app.baseUrl}/rss?region=DE`)).text();

  expect(items[0]._id).toMatch(/^[0-9a-f]{24}$/);
  expect(tag(itemsOf(xml)[0], 'guid')).toBe(`${SITE}/playlist/${items[0]._id}`);
});

// openspec/specs/rss-feed/spec.md
// Requirement: XML escaping of feed text. Scenario: Special characters in track data.
test('feed escapes track text exactly once', async ({ app }) => {
  const xml = await (await get(`${app.baseUrl}/rss?region=AU`)).text();

  expect(xml).toContain('Rock &amp; Roll &lt;Live&gt; &mdash; Artist &quot;X&quot;');
  expect(xml).not.toContain('&amp;amp;');
  expect(xml).not.toContain('&amp;lt;');
  expect(xml).not.toContain('Rock & Roll');
});

// openspec/specs/rss-feed/spec.md
// Requirement: Rate limiting. Scenario: Request over the limit.
test('feed answers 429 over the shared limit', async ({ app }) => {
  // Its own client address, so spending this budget doesn't touch the other tests'.
  const headers = asClient('203.0.113.10');
  for (let i = 0; i < 50; i++) {
    expect((await fetch(`${app.baseUrl}/rss`, { headers })).status).toBe(200);
    expect((await fetch(`${app.baseUrl}/spotify`, { headers })).status).toBe(200);
  }

  const response = await fetch(`${app.baseUrl}/rss`, { headers });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Too many requests, please try again later.' });
});

// openspec/specs/rss-feed/spec.md
// Requirement: Feed discovery links. Scenario: Feed autodiscovery.
test('home page advertises the feed', async ({ app, browser }) => {
  await app.open('/');

  const link = browser.locator('head link[rel="alternate"][type="application/rss+xml"]');
  await expect(link).toHaveAttribute('title', 'Spotify Unchained RSS');
  await expect(link).toHaveAttribute('href', '/rss');
});

// openspec/specs/rss-feed/spec.md
// Requirement: Feed discovery links. Scenario: Header feed link.
test('site header links to the feed in a new tab', async ({ app, screen }) => {
  await app.open('/');

  const link = screen.getByRole('link', 'RSS Feed');
  await expect(link).toHaveAttribute('href', '/rss');
  await expect(link).toHaveAttribute('target', '_blank');
});
