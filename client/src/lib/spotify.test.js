import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savePlaylist, SpotifyError } from './spotify.js';

const json = (body, init = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  ...init,
});

const uris = ['spotify:track:7tICCrK3CcyRFKza7yrR0z', 'spotify:track:1301WleyT98MSxVHPZCA6M'];

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('savePlaylist', () => {
  it('creates the playlist and adds the tracks', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 'pl1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's1' }));

    const result = await savePlaylist('tok', { userId: 'me', name: 'Archive', uris });

    expect(result.savedCount).toBe(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.spotify.com/v1/users/me/playlists');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.spotify.com/v1/playlists/pl1/tracks');
  });

  it('looks up the account id when the cached profile is missing', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 'looked-up' }))
      .mockResolvedValueOnce(json({ id: 'pl1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's1' }));

    await savePlaylist('tok', { userId: undefined, name: 'Archive', uris });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.spotify.com/v1/users/looked-up/playlists');
  });

  it('drops malformed URIs instead of letting Spotify reject the batch', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ id: 'pl1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's1' }));

    const result = await savePlaylist('tok', {
      userId: 'me',
      name: 'Archive',
      uris: [...uris, null, 'spotify:local:whatever'],
    });

    expect(result.savedCount).toBe(2);
    expect(result.skippedCount).toBe(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).uris).toEqual(uris);
  });

  it('refuses a playlist with nothing saveable, without calling Spotify', async () => {
    await expect(savePlaylist('tok', { userId: 'me', name: 'Archive', uris: [] }))
      .rejects.toThrow('no saveable tracks');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the HTTP status and Spotify message on failure', async () => {
    fetchMock.mockResolvedValueOnce(json(
      { error: { status: 401, message: 'The access token expired' } },
      { status: 401 },
    ));

    const err = await savePlaylist('tok', { userId: 'me', name: 'Archive', uris }).catch(e => e);

    expect(err).toBeInstanceOf(SpotifyError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('The access token expired');
  });

  it('retries once after a rate limit', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(json({ id: 'pl1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's1' }));

    const pending = savePlaylist('tok', { userId: 'me', name: 'Archive', uris });
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;

    expect(result.savedCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
