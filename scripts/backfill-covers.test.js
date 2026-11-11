import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { backfillCovers, coverUpdate } from './backfill-covers.js';

const ENV = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret' };
const album = (url300) => ({
  images: [
    { url: 'https://i.scdn.co/image/big', width: 640 },
    { url: url300, width: 300 },
    { url: 'https://i.scdn.co/image/small', width: 64 },
  ],
});
const spotifyTrack = (id) => ({ id, album: album(`https://i.scdn.co/image/${id}`) });

const json = (body) => ({ ok: true, status: 200, json: async () => body });
const failure = (status, headers = {}) => ({
  ok: false,
  status,
  headers: { get: (name) => headers[name] ?? null },
});

// A collection holding the given playlists; updateMany is a spy and writes nothing.
function mockCollection(playlists) {
  return {
    find: vi.fn(() => ({ toArray: async () => playlists })),
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
  };
}

// fetch that answers the token request and serves lookups from `lookup(ids)`.
function mockFetch(lookup) {
  return vi.fn(async (url) => {
    if (String(url).includes('accounts.spotify.com')) return json({ access_token: 'tok' });
    const ids = new URL(url).searchParams.get('ids').split(',');
    return lookup(ids, url);
  });
}
const lookupCalls = (fetchFn) => fetchFn.mock.calls.filter(([u]) => String(u).includes('/v1/tracks'));
const run = (opts) => backfillCovers({ env: ENV, log: () => {}, sleepFn: async () => {}, ...opts });

const track = (id, cover) => ({ id, name: 'n', artist: 'a', ...(cover !== undefined && { cover }) });

describe('fill missing covers only', () => {
  it('sets the 300 px cover on a track without one, with one exact update', async () => {
    const collection = mockCollection([{ _id: 'p1', tracks: [track('a'), track('b', 'https://i.scdn.co/image/b')] }]);
    const fetchFn = mockFetch((ids) => json({ tracks: ids.map(spotifyTrack) }));

    await run({ collection, fetchFn });

    expect(collection.updateMany).toHaveBeenCalledTimes(1);
    expect(collection.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['p1'] }, 'tracks.id': 'a' },
      { $set: { 'tracks.$[t].cover': 'https://i.scdn.co/image/a' } },
      { arrayFilters: [{ 't.id': 'a', 't.cover': { $in: [null, ''] } }] },
    );
  });

  it('does not look up or write a track that already has a cover', async () => {
    const collection = mockCollection([{ _id: 'p1', tracks: [track('b', 'https://i.scdn.co/image/b')] }]);
    const fetchFn = mockFetch(() => json({ tracks: [] }));

    await run({ collection, fetchFn });

    expect(lookupCalls(fetchFn)).toHaveLength(0);
    expect(collection.updateMany).not.toHaveBeenCalled();
  });

  it('leaves a track Spotify no longer has and carries on', async () => {
    const collection = mockCollection([{ _id: 'p1', tracks: [track('gone'), track('c'), track('noimg')] }]);
    const fetchFn = mockFetch(() => json({
      tracks: [null, spotifyTrack('c'), { id: 'noimg', album: { images: [] } }],
    }));

    const summary = await run({ collection, fetchFn });

    expect(collection.updateMany).toHaveBeenCalledTimes(1);
    expect(collection.updateMany.mock.calls[0][0]).toEqual({ _id: { $in: ['p1'] }, 'tracks.id': 'c' });
    expect(summary).toMatchObject({ looked: 3, found: 1, notFound: 2 });
  });

  it('only ever writes the cover update shape', () => {
    const [filter, update, options] = coverUpdate('x', 'https://i.scdn.co/image/x', ['p1']);
    expect(Object.keys(update)).toEqual(['$set']);
    expect(Object.keys(update.$set)).toEqual(['tracks.$[t].cover']);
    expect(filter).toEqual({ _id: { $in: ['p1'] }, 'tracks.id': 'x' });
    expect(options).toEqual({ arrayFilters: [{ 't.id': 'x', 't.cover': { $in: [null, ''] } }] });
  });
});

describe('one lookup per distinct track', () => {
  it('asks once for a track in two editions and the update covers both', async () => {
    const collection = mockCollection([
      { _id: 'us', tracks: [track('a')] },
      { _id: 'ca', tracks: [track('a')] },
    ]);
    const fetchFn = mockFetch((ids) => json({ tracks: ids.map(spotifyTrack) }));

    const summary = await run({ collection, fetchFn });

    expect(lookupCalls(fetchFn)).toHaveLength(1);
    expect(new URL(lookupCalls(fetchFn)[0][0]).searchParams.get('ids')).toBe('a');
    // One update names every playlist holding the track.
    expect(collection.updateMany).toHaveBeenCalledTimes(1);
    expect(collection.updateMany.mock.calls[0][0]).toEqual({ _id: { $in: ['us', 'ca'] }, 'tracks.id': 'a' });
    expect(summary).toMatchObject({ looked: 1, playlists: 2, tracks: 2 });
  });

  it('batches 50 ids per request', async () => {
    const tracks = Array.from({ length: 120 }, (_, i) => track(`t${i}`));
    const collection = mockCollection([{ _id: 'p', tracks }]);
    const fetchFn = mockFetch((ids) => json({ tracks: ids.map(spotifyTrack) }));

    await run({ collection, fetchFn });

    const sizes = lookupCalls(fetchFn).map(([u]) => new URL(u).searchParams.get('ids').split(',').length);
    expect(sizes).toEqual([50, 50, 20]);
  });
});

describe('Spotify rate limits honoured', () => {
  it('waits Retry-After seconds on 429 and repeats the same lookup', async () => {
    const collection = mockCollection([{ _id: 'p', tracks: [track('a')] }]);
    let first = true;
    const fetchFn = mockFetch((ids) => {
      if (first) { first = false; return failure(429, { 'Retry-After': '5' }); }
      return json({ tracks: ids.map(spotifyTrack) });
    });
    const sleepFn = vi.fn(async () => {});

    await run({ collection, fetchFn, sleepFn });

    expect(sleepFn).toHaveBeenCalledWith(5000);
    const calls = lookupCalls(fetchFn);
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe(calls[0][0]);
    expect(collection.updateMany).toHaveBeenCalledTimes(1);
  });

  it('gets a new token once on 401 and repeats', async () => {
    const collection = mockCollection([{ _id: 'p', tracks: [track('a')] }]);
    let first = true;
    const fetchFn = mockFetch((ids) => {
      if (first) { first = false; return failure(401); }
      return json({ tracks: ids.map(spotifyTrack) });
    });

    await run({ collection, fetchFn });

    const tokenCalls = fetchFn.mock.calls.filter(([u]) => String(u).includes('accounts.spotify.com'));
    expect(tokenCalls).toHaveLength(2);
    expect(collection.updateMany).toHaveBeenCalledTimes(1);
  });

  it('throws on a 500 and keeps the covers already written', async () => {
    const tracks = Array.from({ length: 60 }, (_, i) => track(`t${i}`));
    const collection = mockCollection([{ _id: 'p', tracks }]);
    let batches = 0;
    const fetchFn = mockFetch((ids) => (++batches === 1 ? json({ tracks: ids.map(spotifyTrack) }) : failure(500)));

    await expect(run({ collection, fetchFn })).rejects.toThrow('500');

    // The first batch's 50 writes happened and nothing was undone.
    expect(collection.updateMany).toHaveBeenCalledTimes(50);
  });
});

describe('safe to rerun', () => {
  it('writes nothing when every track already has a cover', async () => {
    const collection = mockCollection([{ _id: 'p', tracks: [track('a', 'https://i.scdn.co/image/a')] }]);
    const fetchFn = mockFetch(() => json({ tracks: [] }));

    const summary = await run({ collection, fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(collection.updateMany).not.toHaveBeenCalled();
    expect(summary.tracks).toBe(0);
  });
});

describe('dry run', () => {
  it('looks up but writes nothing, and reports what it would update', async () => {
    const collection = mockCollection([
      { _id: 'us', tracks: [track('a'), track('b')] },
      { _id: 'ca', tracks: [track('a')] },
    ]);
    const fetchFn = mockFetch((ids) => json({ tracks: ids.map(spotifyTrack) }));
    const log = vi.fn();

    const summary = await run({ collection, fetchFn, dryRun: true, log });

    expect(lookupCalls(fetchFn)).toHaveLength(1);
    expect(collection.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ playlists: 2, tracks: 3 });
    expect(log).toHaveBeenCalledWith('Playlists would be updated: 2');
    expect(log).toHaveBeenCalledWith('Tracks would be updated: 3');
  });
});

describe('run summary', () => {
  it('prints looked up, found, left without, and playlists and tracks updated', async () => {
    const collection = mockCollection([{ _id: 'p', tracks: [track('a'), track('gone')] }]);
    const fetchFn = mockFetch(() => json({ tracks: [spotifyTrack('a'), null] }));
    const log = vi.fn();

    await run({ collection, fetchFn, log });

    const lines = log.mock.calls.map(([l]) => l);
    expect(lines).toEqual(expect.arrayContaining([
      'Tracks looked up: 2',
      'Covers found: 1',
      'Left without a cover: 1',
      'Playlists updated: 1',
      'Tracks updated: 1',
    ]));
  });
});

describe('entry point and configuration', () => {
  it('exits non-zero naming the missing variable, before touching the database', () => {
    const script = fileURLToPath(new URL('./backfill-covers.js', import.meta.url));
    // The child starts without a database: it must stop at the variable check.
    const env = { PATH: process.env.PATH, DB_URI: 'mongodb://127.0.0.1:1/none', SPOTIFY_CLIENT_ID: 'id' };
    const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', cwd: '/', timeout: 20000 });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SPOTIFY_CLIENT_SECRET');
    expect(result.stderr).not.toContain('DB_URI');
  });
});
