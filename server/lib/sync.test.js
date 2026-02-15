import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRecentFriday, fetchPlaylistTracks, syncPlaylist } from './sync.js';

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
});
