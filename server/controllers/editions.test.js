import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';

vi.mock('../models/playlist.js', () => {
  const aggregate = vi.fn();
  const findById = vi.fn();
  return { default: { aggregate, findById, _mocks: { aggregate, findById } } };
});

import { index, show } from './editions.js';
import Playlist from '../models/playlist.js';
import router from '../routes/playlist.js';

const { aggregate, findById } = Playlist._mocks;

function mockRes() {
  return {
    json: vi.fn(),
    set: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
}

const ID = '65f1a2b3c4d5e6f708192a3b';

describe('editions controller - index', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists editions without tracks', async () => {
    aggregate.mockResolvedValue([
      { _id: ID, title: 'New.Music.Friday.11.07.2025', region: 'US', published_date: new Date('2025-11-13T00:00:00Z'), trackCount: 30 },
    ]);
    const res = mockRes();
    await index({}, res);

    expect(res.json).toHaveBeenCalledWith({
      items: [{ id: ID, title: 'New.Music.Friday.11.07.2025', region: 'US', date: '2025-11-07', trackCount: 30 }],
    });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    // never loads tracks: only a $size projection
    const project = aggregate.mock.calls[0][0].find(s => s.$project).$project;
    expect(project.tracks).toBeUndefined();
    expect(JSON.stringify(project.trackCount)).toContain('$size');
  });

  it('orders by date, then region, and defaults a missing region to US', async () => {
    const d = new Date('2026-02-14T00:00:00Z');
    aggregate.mockResolvedValue([
      { _id: 'b', title: 'New.Music.Friday.UK.02.14.2026', region: 'UK', published_date: d, trackCount: 1 },
      { _id: 'c', title: 'New.Music.Friday.02.14.2026', published_date: d, trackCount: 1 },
      { _id: 'a', title: 'New.Music.Friday.02.07.2026', region: 'US', published_date: d, trackCount: 1 },
    ]);
    const res = mockRes();
    await index({}, res);
    const { items } = res.json.mock.calls[0][0];
    expect(items.map(i => `${i.date} ${i.region}`)).toEqual(['2026-02-07 US', '2026-02-14 US', '2026-02-14 UK']);
  });

  it('lists one US item for a duplicated week, the later published one', async () => {
    aggregate.mockResolvedValue([
      { _id: 'old', title: 'New.Music.Friday.US.02.06.2026', region: 'US', published_date: new Date('2026-02-06T00:00:00Z'), trackCount: 100 },
      { _id: 'new', title: 'New.Music.Friday.02.06.2026', region: 'US', published_date: new Date('2026-02-12T00:00:00Z'), trackCount: 100 },
    ]);
    const res = mockRes();
    await index({}, res);
    const { items } = res.json.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'new', date: '2026-02-06' });
  });

  it('dates a leading ISO title and an undated title', async () => {
    aggregate.mockResolvedValue([
      { _id: 'x', title: '2014-12-30 New Music Tuesday', region: 'US', published_date: new Date('2015-01-05T00:00:00Z'), trackCount: 1 },
      { _id: 'y', title: 'Mystery', region: 'UK', published_date: new Date('2026-02-14T00:00:00Z'), trackCount: 1 },
    ]);
    const res = mockRes();
    await index({}, res);
    expect(res.json.mock.calls[0][0].items.map(i => i.date)).toEqual(['2014-12-30', '2026-02-14']);
  });

  it('responds 500 without exposing the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    aggregate.mockRejectedValue(new Error('secret db detail'));
    const res = mockRes();
    await index({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('editions controller - show', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockReturnValue({ lean: () => Promise.resolve(null) });
  });

  it('returns the edition with all tracks in archive order', async () => {
    const tracks = Array.from({ length: 30 }, (_, i) => ({
      _id: `t${i}`, created: new Date(), id: `id${i}`, name: `n${i}`, artist: 'a',
      open_url: `u${i}`, uri: `s${i}`, added_at: new Date('2026-02-06T00:00:00Z'),
    }));
    findById.mockReturnValue({
      lean: () => Promise.resolve({ _id: ID, title: 'New.Music.Friday.02.06.2026', region: 'US', published_date: new Date('2026-02-12T00:00:00Z'), tracks }),
    });
    const res = mockRes();
    await show({ params: { id: ID } }, res);

    const body = res.json.mock.calls[0][0];
    expect(res.status).not.toHaveBeenCalled();
    expect(body).toMatchObject({ id: ID, title: 'New.Music.Friday.02.06.2026', region: 'US', date: '2026-02-06' });
    expect(body.tracks).toHaveLength(30);
    expect(body.tracks.map(t => t.id)).toEqual(tracks.map(t => t.id));
    expect(Object.keys(body.tracks[0]).sort()).toEqual(['added_at', 'artist', 'id', 'name', 'open_url', 'uri']);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
  });

  it('404s on a well-formed unknown id', async () => {
    const res = mockRes();
    await show({ params: { id: ID } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('404s on a malformed id without querying', async () => {
    const res = mockRes();
    await show({ params: { id: 'not-an-id' } }, res);
    expect(findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('responds 500 on a query failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    findById.mockReturnValue({ lean: () => Promise.reject(new Error('boom')) });
    const res = mockRes();
    await show({ params: { id: ID } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('edition rate limit (routes)', () => {
  let server;
  let base;

  beforeAll(async () => {
    aggregate.mockResolvedValue([]);
    const app = express();
    app.use(router);
    await new Promise(r => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); });
  });
  afterAll(() => new Promise(r => server.close(r)));

  it('rejects the 301st combined edition request with 429, and edition requests do not spend the list limit', async () => {
    // 100 index requests, then the list endpoint must still answer
    for (let i = 0; i < 100; i++) await fetch(`${base}/spotify/editions`);
    expect((await fetch(`${base}/spotify`)).status).not.toBe(429);

    // 100 so far; 200 more (mix of both routes) reach 300
    for (let i = 0; i < 100; i++) await fetch(`${base}/spotify/editions`);
    for (let i = 0; i < 100; i++) {
      expect((await fetch(`${base}/spotify/editions/not-an-id`)).status).toBe(404);
    }
    const res = await fetch(`${base}/spotify/editions`);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many requests, please try again later.' });
  });
});
