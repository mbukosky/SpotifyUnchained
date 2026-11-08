import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRecentFriday, fetchPlaylistTracks, syncPlaylist, sync } from './sync.js';
import { PLAYLIST_IDS } from './regions.js';
import Playlist from '../models/playlist.js';

vi.mock('../models/playlist.js', () => ({
  default: { findOneAndUpdate: vi.fn() },
}));

describe('getRecentFriday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current date when called on a Friday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-13T12:00:00Z')); // Friday
    expect(getRecentFriday()).toBe('02.13.2026');
  });

  it('returns previous Friday when called on Saturday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-14T12:00:00Z')); // Saturday
    expect(getRecentFriday()).toBe('02.13.2026');
  });

  it('returns previous Friday when called on Sunday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z')); // Sunday
    expect(getRecentFriday()).toBe('02.13.2026');
  });

  it('returns previous Friday when called on Thursday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T12:00:00Z')); // Thursday
    expect(getRecentFriday()).toBe('02.13.2026');
  });

  it('returns previous Friday when called on Wednesday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z')); // Wednesday
    expect(getRecentFriday()).toBe('02.13.2026');
  });

  it('handles year boundaries', () => {
    vi.useFakeTimers();
    // Jan 1, 2025 is a Wednesday → previous Friday is Dec 27, 2024
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    expect(getRecentFriday()).toBe('12.27.2024');
  });

  it('handles month boundaries', () => {
    vi.useFakeTimers();
    // March 2, 2026 is a Monday → previous Friday is Feb 27, 2026
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
    expect(getRecentFriday()).toBe('02.27.2026');
  });
});

describe('fetchPlaylistTracks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts track fields correctly from Spotify API response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            added_at: '2026-02-13T00:00:00Z',
            track: {
              id: 'track1',
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              external_urls: { spotify: 'https://open.spotify.com/track/track1' },
              uri: 'spotify:track:track1',
            },
          },
        ],
        next: null,
      }),
    });

    const tracks = await fetchPlaylistTracks('playlist123', 'token123');

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toEqual({
      id: 'track1',
      name: 'Test Song',
      artist: 'Test Artist',
      added_at: new Date('2026-02-13T00:00:00Z'),
      open_url: 'https://open.spotify.com/track/track1',
      uri: 'spotify:track:track1',
    });
  });

  it('handles pagination by following next URL', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ track: { id: 't1', name: 'Song 1', artists: [{ name: 'A1' }], external_urls: {}, uri: '' } }],
          next: 'https://api.spotify.com/v1/playlists/p/tracks?offset=100',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ track: { id: 't2', name: 'Song 2', artists: [{ name: 'A2' }], external_urls: {}, uri: '' } }],
          next: null,
        }),
      });

    const tracks = await fetchPlaylistTracks('p', 'token');
    expect(tracks).toHaveLength(2);
    expect(tracks[0].id).toBe('t1');
    expect(tracks[1].id).toBe('t2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('skips items where item.track is null', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { track: null },
          { track: { id: 't1', name: 'Song', artists: [{ name: 'Artist' }], external_urls: {}, uri: '' } },
        ],
        next: null,
      }),
    });

    const tracks = await fetchPlaylistTracks('p', 'token');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('t1');
  });

  it('uses "Unknown" for missing artist name', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { track: { id: 't1', name: 'Song', artists: [], external_urls: {}, uri: '' } },
        ],
        next: null,
      }),
    });

    const tracks = await fetchPlaylistTracks('p', 'token');
    expect(tracks[0].artist).toBe('Unknown');
  });

  it('throws on non-OK response', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(fetchPlaylistTracks('p', 'token')).rejects.toThrow('Failed to fetch playlist tracks: 401');
  });
});

describe('syncPlaylist', () => {
  it('skips unknown regions', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await syncPlaylist('XX', 'token');
    expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // Issue #169: an empty fetch must not wipe an archived week.
  describe('when Spotify returns no storable tracks', () => {
    const page = (items) => ({ ok: true, json: async () => ({ items, next: null }) });

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-14T12:00:00Z'));
      vi.stubGlobal('fetch', vi.fn());
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      Playlist.findOneAndUpdate.mockReset();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('does not write the archive when items is empty, and logs a warning', async () => {
      fetch.mockResolvedValueOnce(page([]));

      await syncPlaylist('US', 'token');

      expect(Playlist.findOneAndUpdate).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('New.Music.Friday.US.02.13.2026')
      );
    });

    it('does not write the archive when every item has a null track', async () => {
      fetch.mockResolvedValueOnce(page([{ track: null }, { track: null }]));

      await syncPlaylist('US', 'token');

      expect(Playlist.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('still upserts, replacing the track list, when at least one track comes back', async () => {
      fetch.mockResolvedValueOnce(
        page([
          { track: null },
          { track: { id: 't1', name: 'Song', artists: [{ name: 'A' }], external_urls: {}, uri: '' } },
        ])
      );

      await syncPlaylist('US', 'token');

      expect(Playlist.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(Playlist.findOneAndUpdate).toHaveBeenCalledWith(
        { title: 'New.Music.Friday.US.02.13.2026', region: 'US' },
        expect.objectContaining({
          tracks: [expect.objectContaining({ id: 't1' })],
        }),
        { upsert: true, new: true }
      );
    });

    it('keeps syncing later regions in the same run', async () => {
      const [first, ...rest] = Object.keys(PLAYLIST_IDS);
      const track = { id: 't1', name: 'Song', artists: [{ name: 'A' }], external_urls: {}, uri: '' };
      fetch.mockImplementation(async (url) => {
        if (url.startsWith('https://accounts.spotify.com/')) {
          return { ok: true, json: async () => ({ access_token: 'token' }) };
        }
        return page(url.includes(`/playlists/${PLAYLIST_IDS[first]}/`) ? [] : [{ track }]);
      });

      await sync();

      expect(Playlist.findOneAndUpdate).toHaveBeenCalledTimes(rest.length);
      const writtenRegions = Playlist.findOneAndUpdate.mock.calls.map(([filter]) => filter.region);
      expect(writtenRegions).toEqual(rest);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`.${first}.`));
    });
  });
});
