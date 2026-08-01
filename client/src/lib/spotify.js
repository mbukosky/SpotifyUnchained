const API_BASE = 'https://api.spotify.com/v1';
const TRACK_URI_RE = /^spotify:track:[A-Za-z0-9]{22}$/;

export class SpotifyError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function spotifyFetch(path, token, options = {}, retries = 2) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Spotify rate limits per-app, so a busy minute can hit a user who did nothing
  // wrong. Wait out the window it asks for rather than failing the whole save.
  if (res.status === 429 && retries > 0) {
    const wait = Math.min(Number(res.headers.get('Retry-After')) || 1, 10);
    await sleep(wait * 1000);
    return spotifyFetch(path, token, options, retries - 1);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new SpotifyError(res.status, body?.error?.message || `Spotify API error: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function getCurrentUser(token) {
  return spotifyFetch('/me', token);
}

export function createPlaylist(token, userId, name) {
  return spotifyFetch(`/users/${encodeURIComponent(userId)}/playlists`, token, {
    method: 'POST',
    body: JSON.stringify({ name, public: false }),
  });
}

export async function addPlaylistTracks(token, playlistId, uris) {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, token, {
      method: 'POST',
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

/**
 * Copy an archived playlist into the signed-in user's Spotify account.
 *
 * `userId` is optional: the cached profile is missing whenever the /me call made
 * at sign-in failed, and that is not a reason to refuse the save — look the id up
 * here instead. Track URIs are filtered because a single malformed row would make
 * Spotify reject the whole batch and leave an empty playlist behind.
 */
export async function savePlaylist(token, { userId, name, uris }) {
  const validUris = (uris || []).filter(uri => TRACK_URI_RE.test(uri));
  if (validUris.length === 0) {
    throw new Error('This archive has no saveable tracks.');
  }

  const ownerId = userId || (await getCurrentUser(token)).id;
  const playlist = await createPlaylist(token, ownerId, name);
  await addPlaylistTracks(token, playlist.id, validUris);

  return {
    playlist,
    savedCount: validUris.length,
    skippedCount: (uris?.length || 0) - validUris.length,
  };
}
