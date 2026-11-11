import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import zlib from 'node:zlib';

vi.mock('../models/playlist.js', () => {
  const aggregate = vi.fn();
  const findById = vi.fn();
  return { default: { aggregate, findById, _mocks: { aggregate, findById } } };
});

import { trackColumns } from './editions.js';
import Playlist from '../models/playlist.js';
import router from '../routes/playlist.js';
import { invalidateArchive } from '../lib/archiveCache.js';

const { aggregate, findById } = Playlist._mocks;

const ID = '65f1a2b3c4d5e6f708192a3b';

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use(router);
  await new Promise(r => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); });
});
afterAll(() => new Promise(r => server.close(r)));

// Each request comes from its own address so the rate limit never interferes
// (express-rate-limit keys on req.ip; without trust proxy that is the socket).
const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });

beforeEach(() => {
  vi.clearAllMocks();
  invalidateArchive();
  findById.mockReturnValue({ lean: () => Promise.resolve(null) });
});

describe('editions controller - index', () => {
  it('lists editions without tracks or titles', async () => {
    aggregate.mockResolvedValue([
      { _id: ID, title: 'New.Music.Friday.11.07.2025', region: 'US', published_date: new Date('2025-11-13T00:00:00Z'), trackCount: 30 },
    ]);
    const res = await get('/spotify/editions');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [{ id: ID, region: 'US', date: '2025-11-07', trackCount: 30 }],
    });
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    // never loads tracks: only a $size projection
    const project = aggregate.mock.calls[0][0].find(s => s.$project).$project;
    expect(project.tracks).toBeUndefined();
    expect(JSON.stringify(project.trackCount)).toContain('$size');
  });

  it('flags New Music Tuesday editions and only those', async () => {
    aggregate.mockResolvedValue([
      { _id: 'a', title: 'New Music Tuesday 07.22.2014', region: 'US', published_date: new Date('2014-07-22T00:00:00Z'), trackCount: 1 },
      { _id: 'b', title: 'New.Music.Friday.07.10.2015', region: 'US', published_date: new Date('2015-07-10T00:00:00Z'), trackCount: 1 },
    ]);
    const { items } = await (await get('/spotify/editions')).json();
    expect(items).toEqual([
      { id: 'a', region: 'US', date: '2014-07-22', trackCount: 1, tuesday: true },
      { id: 'b', region: 'US', date: '2015-07-10', trackCount: 1 },
    ]);
  });

  it('orders by date, then region, and defaults a missing region to US', async () => {
    const d = new Date('2026-02-14T00:00:00Z');
    aggregate.mockResolvedValue([
      { _id: 'b', title: 'New.Music.Friday.UK.02.14.2026', region: 'UK', published_date: d, trackCount: 1 },
      { _id: 'c', title: 'New.Music.Friday.02.14.2026', published_date: d, trackCount: 1 },
      { _id: 'a', title: 'New.Music.Friday.02.07.2026', region: 'US', published_date: d, trackCount: 1 },
    ]);
    const { items } = await (await get('/spotify/editions')).json();
    expect(items.map(i => `${i.date} ${i.region}`)).toEqual(['2026-02-07 US', '2026-02-14 US', '2026-02-14 UK']);
  });

  it('lists one US item for a duplicated week, the later published one', async () => {
    aggregate.mockResolvedValue([
      { _id: 'old', title: 'New.Music.Friday.US.02.06.2026', region: 'US', published_date: new Date('2026-02-06T00:00:00Z'), trackCount: 100 },
      { _id: 'new', title: 'New.Music.Friday.02.06.2026', region: 'US', published_date: new Date('2026-02-12T00:00:00Z'), trackCount: 100 },
    ]);
    const { items } = await (await get('/spotify/editions')).json();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'new', date: '2026-02-06' });
  });

  it('dates a leading ISO title and an undated title', async () => {
    aggregate.mockResolvedValue([
      { _id: 'x', title: '2014-12-30 New Music Tuesday', region: 'US', published_date: new Date('2015-01-05T00:00:00Z'), trackCount: 1 },
      { _id: 'y', title: 'Mystery', region: 'UK', published_date: new Date('2026-02-14T00:00:00Z'), trackCount: 1 },
    ]);
    const { items } = await (await get('/spotify/editions')).json();
    expect(items.map(i => i.date)).toEqual(['2014-12-30', '2026-02-14']);
  });

  it('builds the index once and serves repeats from memory until the archive changes', async () => {
    aggregate.mockResolvedValue([
      { _id: ID, title: 'New.Music.Friday.11.07.2025', region: 'US', published_date: new Date('2025-11-13T00:00:00Z'), trackCount: 30 },
    ]);
    await get('/spotify/editions');
    await get('/spotify/editions');
    expect(aggregate).toHaveBeenCalledTimes(1);
    invalidateArchive();
    await get('/spotify/editions');
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('answers 304 to a matching If-None-Match', async () => {
    aggregate.mockResolvedValue([]);
    const first = await get('/spotify/editions');
    const etag = first.headers.get('etag');
    expect(etag).toMatch(/^".+"$/);
    const again = await get('/spotify/editions', { 'If-None-Match': etag });
    expect(again.status).toBe(304);
  });

  it('sends Brotli, gzip or plain bytes as the request accepts', async () => {
    aggregate.mockResolvedValue([
      { _id: ID, title: 'New.Music.Friday.11.07.2025', region: 'US', published_date: new Date('2025-11-13T00:00:00Z'), trackCount: 30 },
    ]);
    const expected = JSON.stringify({ items: [{ id: ID, region: 'US', date: '2025-11-07', trackCount: 30 }] });
    // node's fetch decodes for us, so read the raw bytes through http instead.
    const raw = async (encoding) => {
      const http = await import('node:http');
      return new Promise((resolve, reject) => {
        http.get(`${base}/spotify/editions`, { headers: { 'accept-encoding': encoding } }, res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
        }).on('error', reject);
      });
    };
    const br = await raw('gzip, deflate, br');
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers.vary).toBe('Accept-Encoding');
    expect(zlib.brotliDecompressSync(br.body).toString()).toBe(expected);
    const gz = await raw('gzip');
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(zlib.gunzipSync(gz.body).toString()).toBe(expected);
    const plain = await raw('identity');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.body.toString()).toBe(expected);
    expect(Number(plain.headers['content-length'])).toBe(expected.length);
  });

  it('responds 500 without exposing the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    aggregate.mockRejectedValue(new Error('secret db detail'));
    const res = await get('/spotify/editions');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });
});

const TRACK_IDS = Array.from({ length: 30 }, (_, i) => `4uLU6hMCjMI75M1A2tKUQ${String.fromCharCode(65 + (i % 26))}`);

describe('editions controller - show', () => {
  it('returns the edition with all tracks in archive order, as columns', async () => {
    const tracks = TRACK_IDS.map((id, i) => ({
      _id: `t${i}`, created: new Date(), id, name: `n${i}`, artist: 'a',
      open_url: `https://open.spotify.com/track/${id}`, uri: `spotify:track:${id}`, added_at: new Date('2026-02-06T00:00:00Z'),
    }));
    findById.mockReturnValue({
      lean: () => Promise.resolve({ _id: ID, title: 'New.Music.Friday.02.06.2026', region: 'US', published_date: new Date('2026-02-12T00:00:00Z'), tracks }),
    });
    const res = await get(`/spotify/editions/${ID}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: ID, title: 'New.Music.Friday.02.06.2026', region: 'US', date: '2026-02-06' });
    expect(Object.keys(body.tracks).sort()).toEqual(['artist', 'id', 'name']);
    expect(body.tracks.id).toEqual(TRACK_IDS);
    expect(body.tracks.name).toEqual(tracks.map(t => t.name));
    expect(body.tracks.artist).toEqual(tracks.map(t => t.artist));
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('serves a repeat request from memory', async () => {
    findById.mockReturnValue({ lean: () => Promise.resolve({ _id: ID, title: 'New.Music.Friday.02.06.2026', region: 'US', published_date: new Date(), tracks: [] }) });
    expect((await get(`/spotify/editions/${ID}`)).status).toBe(200);
    expect((await get(`/spotify/editions/${ID}`)).status).toBe(200);
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('404s on a well-formed unknown id', async () => {
    const res = await get(`/spotify/editions/${ID}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('404s on a malformed id without querying', async () => {
    const res = await get('/spotify/editions/not-an-id');
    expect(findById).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('responds 500 on a query failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    findById.mockReturnValue({ lean: () => Promise.reject(new Error('boom')) });
    const res = await get(`/spotify/editions/${ID}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });
});

describe('trackColumns', () => {
  it('leaves out uri and open_url when every track’s follow from its id', () => {
    const id = TRACK_IDS[0];
    expect(trackColumns([{ id, name: 'n', artist: 'a', uri: `spotify:track:${id}`, open_url: `https://open.spotify.com/track/${id}` }]))
      .toEqual({ id: [id], name: ['n'], artist: ['a'] });
  });

  it('sends the full uri column when any stored uri differs', () => {
    const [a, b] = TRACK_IDS;
    const cols = trackColumns([
      { id: a, name: 'x', artist: 'y', uri: `spotify:track:${a}`, open_url: `https://open.spotify.com/track/${a}` },
      { id: b, name: 'x', artist: 'y', uri: '', open_url: `https://open.spotify.com/track/${b}` },
    ]);
    expect(cols.uri).toEqual([`spotify:track:${a}`, '']);
    expect(cols.open_url).toBeUndefined();
  });

  it('sends the full open_url column when any stored URL differs or is missing', () => {
    const [a] = TRACK_IDS;
    const cols = trackColumns([{ id: a, name: 'x', artist: 'y', uri: `spotify:track:${a}` }]);
    expect(cols.open_url).toEqual([null]);
    expect(cols.uri).toBeUndefined();
  });
});

describe('trackColumns - cover', () => {
  const derived = id => ({ id, name: 'x', artist: 'y', uri: `spotify:track:${id}`, open_url: `https://open.spotify.com/track/${id}` });

  it('sends a full cover column with null for a track without one', () => {
    const [a, b] = TRACK_IDS;
    const cols = trackColumns([{ ...derived(a), cover: 'https://i.scdn.co/image/a' }, { ...derived(b), cover: '' }]);
    expect(cols.cover).toEqual(['https://i.scdn.co/image/a', null]);
  });

  it('leaves out the cover column when no track has a cover', () => {
    const [a, b] = TRACK_IDS;
    expect(trackColumns([derived(a), { ...derived(b), cover: '' }]).cover).toBeUndefined();
  });
});

describe('edition rate limit (routes)', () => {
  it('allows 900 combined edition requests, rejects the next with 429, and does not spend the list limit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    aggregate.mockResolvedValue([]);
    // Earlier tests in this file share the limiter, so count from what it reports.
    const first = await get('/spotify/editions');
    expect(first.headers.get('ratelimit-limit')).toBe('900');
    let remaining = Number(first.headers.get('ratelimit-remaining'));

    // 100 index requests, then the list endpoint must still answer
    for (let i = 0; i < 100; i++, remaining--) await get('/spotify/editions');
    expect((await get('/spotify')).status).not.toBe(429);

    // spend the rest on both routes
    while (remaining > 0) {
      expect((await get('/spotify/editions/not-an-id')).status).toBe(404);
      remaining--;
    }
    const res = await get('/spotify/editions');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many requests, please try again later.' });
  }, 30_000);
});
