import { expect } from 'e2e';
import { test } from './fixtures.ts';
import { asClient, editionId } from './helpers.ts';

// Spot checks against the seed: 69 playlists, of which UK has 2 and AU has 53. The
// edition index lists 68, because it drops one of the two US 01.23.2026 rows.
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

  expect(count).toBe(69);
  expect(items).toHaveLength(5);
  expect(Array.isArray(items[0].tracks)).toBe(true);
  expect(items[0].tracks[0].id).toEqual(expect.any(String));
});

// openspec/specs/playlist-api/spec.md
// Requirement: List response shape. Scenario: Count ignores pagination.
test('count ignores pagination', async ({ app }) => {
  const { count, items } = await list(app.baseUrl, '?size=1&page=2');

  expect(count).toBe(69);
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
  const found = dates((await list(app.baseUrl, '?size=100')).items);

  expect(found).toEqual([...found].sort((a, b) => a - b));
  expect(found).toHaveLength(69);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Sort order by publication date. Scenario: Descending requested.
test('sort=desc returns newest first', async ({ app }) => {
  const found = dates((await list(app.baseUrl, '?size=100&sort=desc')).items);

  expect(found).toEqual([...found].sort((a, b) => b - a));
});

// openspec/specs/playlist-api/spec.md
// Requirement: Sort order by publication date. Scenario: Unrecognised sort value.
test('an unrecognised sort is treated as ascending', async ({ app }) => {
  const found = dates((await list(app.baseUrl, '?size=100&sort=newest')).items);

  expect(found).toEqual([...found].sort((a, b) => a - b));
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region ordering for same-date playlists. Scenario: Same-date playlists in menu order.
test('same-date playlists keep menu order in both directions', async ({ app }) => {
  const regions = ['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'];
  const regionsOn = (items: any[], day: string) =>
    items.filter((item) => item.published_date.startsWith(day)).map((item) => item.region);

  const newest = await list(app.baseUrl, '?size=14&sort=desc');
  const oldest = await list(app.baseUrl, '?size=100');

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
  expect((await list(app.baseUrl, '?region=INVALID')).count).toBe(69);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Region filter. Scenario: Region match is case-sensitive.
test('region match is case-sensitive', async ({ app }) => {
  expect((await list(app.baseUrl, '?region=uk')).count).toBe(69);
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

// Edition endpoints. Their own address too: they have a separate 900-request budget.
const editionHeaders = asClient('203.0.113.33');
const getJson = async (url: string, expected = 200) => {
  const response = await fetch(url, { headers: editionHeaders });
  expect(response.status).toBe(expected);
  return response.json() as Promise<any>;
};
const editionIndex = async (baseUrl: string) => (await getJson(`${baseUrl}/spotify/editions`)).items as any[];

// openspec/specs/playlist-api/spec.md
// Requirement: Edition index. Scenario: Index lists editions without tracks.
test('edition index lists editions without tracks', async ({ app }) => {
  const body = await getJson(`${app.baseUrl}/spotify/editions`);

  expect(Object.keys(body)).toEqual(['items']);
  expect(body.items).toHaveLength(68);
  for (const item of body.items) {
    expect(Object.keys(item).sort()).toEqual(
      item.tuesday ? ['date', 'id', 'region', 'trackCount', 'tuesday'] : ['date', 'id', 'region', 'trackCount'],
    );
  }
  expect(body.items.find((item: any) => item.id === editionId('CA'))).toEqual({
    id: editionId('CA'),
    region: 'CA',
    date: '2026-02-14',
    trackCount: 250,
  });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition index. Scenario: Index order.
test('edition index runs by date, then region order', async ({ app }) => {
  const items = await editionIndex(app.baseUrl);
  const keys = items.map((item) => `${item.date} ${item.region}`);

  expect(keys.indexOf('2026-02-07 US')).toBeLessThan(keys.indexOf('2026-02-14 US'));
  expect(keys.indexOf('2026-02-14 US')).toBeLessThan(keys.indexOf('2026-02-14 UK'));
  expect(keys.slice(-7)).toEqual(['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU'].map((r) => `2026-02-14 ${r}`));
  const dates = items.map((item) => item.date);
  expect(dates).toEqual([...dates].sort());
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition date. Scenario: Date from a dotted title.
// The seed publishes this one six days late, as rows synced before 2026 were.
test('edition date comes from a dotted title', async ({ app }) => {
  const item = (await editionIndex(app.baseUrl)).find((e) => e.id === editionId('US', '07.10.2015'));

  expect(item).toMatchObject({ region: 'US', date: '2015-07-10' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition date. Scenario: Date from a leading ISO date.
test('edition date comes from a leading ISO date', async ({ app }) => {
  const item = (await editionIndex(app.baseUrl)).find((e) => e.id === editionId('US', '07.07.2015'));

  expect(item).toMatchObject({ region: 'US', date: '2015-07-07' });
});

// openspec/changes/friday-wall/specs/playlist-api/spec.md
// Requirement: Edition index. Scenario: Tuesday flag.
test('only the Tuesday edition carries the tuesday flag', async ({ app }) => {
  const items = await editionIndex(app.baseUrl);
  const flagged = items.filter((item) => 'tuesday' in item);

  expect(flagged.map((item) => item.id)).toEqual([editionId('US', '07.07.2015')]);
  expect(flagged[0].tuesday).toBe(true);
  expect(items.find((item) => item.id === editionId('US', '07.10.2015'))).not.toHaveProperty('tuesday');
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition date. Scenario: Title without a date.
// Published at midnight UTC on 2024-12-20, not the scenario's 2026-02-14: every seed
// region already has an edition that day, which would out-rank this one.
test('edition date falls back to the published date', async ({ app }) => {
  const item = (await editionIndex(app.baseUrl)).find((e) => e.id === editionId('AU', '12.20.2024'));

  expect(item).toMatchObject({ region: 'AU', date: '2024-12-20' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: One edition per region and date. Scenario: Duplicate week.
// The seed's pair is dated 01.23.2026 rather than 02.06.2026, so the US wall has a gap.
test('a duplicate week is listed once, the later published', async ({ app }) => {
  const items = (await editionIndex(app.baseUrl)).filter((e) => e.region === 'US' && e.date === '2026-01-23');

  expect(items.map((e) => e.id)).toEqual([editionId('US', '01.23.2026', '000000002')]);
});

// openspec/specs/playlist-api/spec.md
// Requirement: Single edition. Scenario: Edition found.
test('a single edition has its tracks in archive order', async ({ app }) => {
  const edition = await getJson(`${app.baseUrl}/spotify/editions/${editionId('US')}`);

  expect(edition).toMatchObject({
    id: editionId('US'),
    title: 'New.Music.Friday.US.02.14.2026',
    region: 'US',
    date: '2026-02-14',
  });
  // Every seed US track has the derivable uri and open_url, so only three columns are sent.
  expect(Object.keys(edition.tracks).sort()).toEqual(['artist', 'id', 'name']);
  expect(edition.tracks.id).toHaveLength(30);
  expect(edition.tracks.artist).toHaveLength(30);
  expect(edition.tracks.name).toEqual(Array.from({ length: 30 }, (_, i) => `Test Track ${i + 1} US`));
});

// openspec/changes/friday-wall/specs/playlist-api/spec.md
// Requirement: Single edition. Scenario: Non-derivable fields sent as full columns.
// BR has empty and malformed uris; AU 02.07 has one open_url that isn't derived from its id.
test('uri and open_url columns are sent only when some track differs', async ({ app }) => {
  const br = await getJson(`${app.baseUrl}/spotify/editions/${editionId('BR')}`);
  expect(Object.keys(br.tracks).sort()).toEqual(['artist', 'id', 'name', 'uri']);
  expect(br.tracks.uri).toHaveLength(5);
  expect(br.tracks.uri[1]).toBe('');
  expect(br.tracks.uri[4]).toBe('not-a-uri');

  const au = await getJson(`${app.baseUrl}/spotify/editions/${editionId('AU', '02.07.2026')}`);
  expect(Object.keys(au.tracks).sort()).toEqual(['artist', 'id', 'name', 'open_url']);
  expect(au.tracks.open_url).toHaveLength(au.tracks.id.length);
  expect(au.tracks.open_url).toContain('https://open.spotify.com/track/123');
});

// openspec/changes/friday-wall/specs/playlist-api/spec.md
// Requirement: Compressed, revalidatable archive responses. Scenario: Conditional request matches.
test('a matching If-None-Match gets a 304', async ({ app }) => {
  for (const path of ['/spotify/editions', `/spotify/editions/${editionId('US')}`, '/spotify?size=1']) {
    const first = await fetch(`${app.baseUrl}${path}`, { headers: editionHeaders });
    const etag = first.headers.get('etag');
    expect(first.status).toBe(200);
    expect(etag).toMatch(/^"/);
    expect(first.headers.get('vary')).toMatch(/accept-encoding/i);

    const second = await fetch(`${app.baseUrl}${path}`, { headers: { ...editionHeaders, 'if-none-match': etag! } });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  }
});

// openspec/specs/playlist-api/spec.md
// Requirement: Single edition. Scenario: Unknown id.
test('an unknown edition id is 404', async ({ app }) => {
  expect(await getJson(`${app.baseUrl}/spotify/editions/e2e000000000000000000000`, 404)).toEqual({ error: 'Not found' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Single edition. Scenario: Malformed id.
test('a malformed edition id is 404', async ({ app }) => {
  expect(await getJson(`${app.baseUrl}/spotify/editions/not-an-id`, 404)).toEqual({ error: 'Not found' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition rate limit. Scenario: Edition limit exceeded.
test('edition endpoints answer 429 on the 901st combined request', async ({ app }) => {
  const ownHeaders = asClient('203.0.113.34');
  for (let i = 0; i < 450; i++) {
    expect((await fetch(`${app.baseUrl}/spotify/editions`, { headers: ownHeaders })).status).toBe(200);
    expect((await fetch(`${app.baseUrl}/spotify/editions/${editionId('DE')}`, { headers: ownHeaders })).status).toBe(200);
  }

  const response = await fetch(`${app.baseUrl}/spotify/editions/${editionId('DE')}`, { headers: ownHeaders });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'Too many requests, please try again later.' });
});

// openspec/specs/playlist-api/spec.md
// Requirement: Edition rate limit. Scenario: Edition requests do not spend the list limit.
test('edition requests do not spend the list limit', async ({ app }) => {
  const ownHeaders = asClient('203.0.113.35');
  for (let i = 0; i < 100; i++) {
    expect((await fetch(`${app.baseUrl}/spotify/editions`, { headers: ownHeaders })).status).toBe(200);
  }

  expect((await fetch(`${app.baseUrl}/spotify?size=1`, { headers: ownHeaders })).status).toBe(200);
});
