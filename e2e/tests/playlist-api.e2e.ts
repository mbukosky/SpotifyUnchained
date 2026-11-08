import { expect } from 'e2e';
import { test } from './fixtures.ts';
import { asClient } from './helpers.ts';

// Spot checks against the seed: 64 playlists, of which UK has 2 and AU has 52.
// Query parsing and clamping in depth belong to server/controllers/playlist.test.js.

// Their own client address, so these checks don't use up the browser tests' request budget.
const headers = asClient('203.0.113.32');

const list = async (baseUrl: string, query = '') => {
  const response = await fetch(`${baseUrl}/spotify${query}`, { headers });
  expect(response.status).toBe(200);
  return (await response.json()) as { count: number; items: any[] };
};
const dates = (items: any[]) => items.map((item) => Date.parse(item.published_date));

// openspec/specs/playlist-api/spec.md
// Requirement: List response shape. Scenario: Successful list.
test('list answers with count and items', async ({ app }) => {
  const { count, items } = await list(app.baseUrl);

  expect(count).toBe(64);
  expect(items).toHaveLength(5);
  expect(Array.isArray(items[0].tracks)).toBe(true);
  expect(items[0].tracks[0].id).toEqual(expect.any(String));
});

// openspec/specs/playlist-api/spec.md
// Requirement: List response shape. Scenario: Count ignores pagination.
test('count ignores pagination', async ({ app }) => {
  const { count, items } = await list(app.baseUrl, '?size=1&page=2');

  expect(count).toBe(64);
  expect(items).toHaveLength(1);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Pagination parameters. Scenario: Size clamped to minimum.
test('negative size is raised to 1', async ({ app }) => {
  expect((await list(app.baseUrl, '?size=-5')).items).toHaveLength(1);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Pagination parameters. Scenario: Non-numeric or zero values fall back to default.
test('non-numeric size and zero page fall back to the defaults', async ({ app }) => {
  expect((await list(app.baseUrl, '?size=abc')).items).toHaveLength(5);

  const firstPage = await list(app.baseUrl, '?page=0&sort=desc&size=1');
  expect(firstPage.items[0].title).toBe('New.Music.Friday.US.02.14.2026');
});

// openspec/specs/playlist-api/spec.md
// Requirement: Pagination parameters. Scenario: Page offset.
test('page and size skip earlier results', async ({ app }) => {
  const { items } = await list(app.baseUrl, '?page=2&size=10&sort=desc');

  expect(items).toHaveLength(10);
  // The first 10 are all seven regions of 02.14, then US, UK and CA of 02.07.
  expect(items[0].title).toBe('New.Music.Friday.BR.02.07.2026');
});

// openspec/specs/playlist-api/spec.md
// Requirement: Sort order by publication date. Scenario: Default ascending.
test('results default to oldest first', async ({ app }) => {
  const found = dates((await list(app.baseUrl, '?size=64')).items);

  expect(found).toEqual([...found].sort((a, b) => a - b));
  expect(found).toHaveLength(64);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Sort order by publication date. Scenario: Descending requested.
test('sort=desc returns newest first', async ({ app }) => {
  const found = dates((await list(app.baseUrl, '?size=64&sort=desc')).items);

  expect(found).toEqual([...found].sort((a, b) => b - a));
});

// openspec/specs/playlist-api/spec.md
// Requirement: Sort order by publication date. Scenario: Unrecognised sort value.
test('an unrecognised sort is treated as ascending', async ({ app }) => {
  const found = dates((await list(app.baseUrl, '?size=64&sort=newest')).items);

  expect(found).toEqual([...found].sort((a, b) => a - b));
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region ordering for same-date playlists. Scenario: Same-date playlists in menu order.
test('same-date playlists keep menu order in both directions', async ({ app }) => {
  const regions = ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];
  const regionsOn = (items: any[], day: string) =>
    items.filter((item) => item.published_date.startsWith(day)).map((item) => item.region);

  const newest = await list(app.baseUrl, '?size=14&sort=desc');
  const oldest = await list(app.baseUrl, '?size=64');

  expect(regionsOn(newest.items, '2026-02-14')).toEqual(regions);
  expect(regionsOn(oldest.items, '2026-02-14')).toEqual(regions);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region filter. Scenario: Valid region filter.
test('region filters items and count', async ({ app }) => {
  const { count, items } = await list(app.baseUrl, '?region=UK');

  expect(count).toBe(2);
  expect(items.map((item) => item.region)).toEqual(['UK', 'UK']);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region filter. Scenario: Unrecognised region ignored.
test('an unrecognised region returns all regions', async ({ app }) => {
  expect((await list(app.baseUrl, '?region=INVALID')).count).toBe(64);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region filter. Scenario: Region match is case-sensitive.
test('region match is case-sensitive', async ({ app }) => {
  expect((await list(app.baseUrl, '?region=uk')).count).toBe(64);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Per-client rate limit. Scenario: Limit exceeded.
test('list answers 429 on the 101st combined request', async ({ app }) => {
  // Its own client address, so spending this budget doesn't touch the other tests'.
  const ownHeaders = asClient('203.0.113.30');
  for (let i = 0; i < 50; i++) {
    expect((await fetch(`${app.baseUrl}/spotify`, { headers: ownHeaders })).status).toBe(200);
    expect((await fetch(`${app.baseUrl}/rss`, { headers: ownHeaders })).status).toBe(200);
  }

  const response = await fetch(`${app.baseUrl}/spotify`, { headers: ownHeaders });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Too many requests, please try again later.' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Per-client rate limit. Scenario: Feed requests share the limit.
test('feed requests use up the list limit', async ({ app }) => {
  const ownHeaders = asClient('203.0.113.31');
  for (let i = 0; i < 100; i++) {
    expect((await fetch(`${app.baseUrl}/rss`, { headers: ownHeaders })).status).toBe(200);
  }

  expect((await fetch(`${app.baseUrl}/spotify`, { headers: ownHeaders })).status).toBe(429);
});
