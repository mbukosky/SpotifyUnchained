import cron from 'node-cron';
import config from '../config.js';
import Playlist from '../models/playlist.js';

const PLAYLIST_IDS = {
  US: '37i9dQZF1DX4JAvHpjipBk',
  UK: '37i9dQZF1DX4W3aJJYCDfV',
};

function getRecentFriday() {
  const now = new Date();
  const day = now.getDay();
  // Days since last Friday: Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=0, Sat=1
  const diff = (day + 2) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  const mm = String(friday.getMonth() + 1).padStart(2, '0');
  const dd = String(friday.getDate()).padStart(2, '0');
  const yyyy = friday.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

async function getClientToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.spotifyClientId,
      client_secret: config.spotifyClientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get client token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchPlaylistTracks(playlistId, token) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist tracks: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.items) {
      if (!item.track) continue;
      tracks.push({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists?.[0]?.name || 'Unknown',
        added_at: item.added_at ? new Date(item.added_at) : new Date(),
        open_url: item.track.external_urls?.spotify || '',
        uri: item.track.uri || '',
      });
    }

    url = data.next;
  }

  return tracks;
}

async function syncPlaylist(region, token) {
  const playlistId = PLAYLIST_IDS[region];
  if (!playlistId) return;

  const fridayDate = getRecentFriday();
  const title = `New.Music.Friday.${region}.${fridayDate}`;

  console.log(`Syncing ${title}...`);

  const tracks = await fetchPlaylistTracks(playlistId, token);

  const parts = fridayDate.split('.');
  const publishedDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);

  await Playlist.findOneAndUpdate(
    { title, region },
    { title, region, published_date: publishedDate, tracks },
    { upsert: true, new: true }
  );

  console.log(`Synced ${title} with ${tracks.length} tracks`);
}

async function sync() {
  try {
    const token = await getClientToken();
    for (const region of Object.keys(PLAYLIST_IDS)) {
      await syncPlaylist(region, token);
    }
    console.log('Sync complete');
  } catch (err) {
    console.error('Sync error:', err);
  }
}

export { getRecentFriday, fetchPlaylistTracks, syncPlaylist };

export function startSync() {
  if (config.skipSync) {
    console.log('Spotify sync disabled (SKIP_SPOTIFY_SYNC=true)');
    return;
  }

  console.log('Starting initial sync...');
  sync();

  cron.schedule('0 */2 * * *', () => {
    console.log('Running scheduled sync...');
    sync();
  });
}
