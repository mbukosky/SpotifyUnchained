import 'dotenv/config';
import mongoose from 'mongoose';
import Playlist from '../server/models/playlist.js';
import { PLAYLIST_IDS } from '../server/lib/regions.js';

const BACKFILL_WEEKS = parseInt(process.env.BACKFILL_WEEKS || '50', 10);
const BACKFILL_REGIONS = ['UK', 'CA', 'BR', 'MX', 'DE'];

const CUMULATIVE_URL = (id) =>
  `https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/cumulative/${id}.md`;

export function parseCumulativeMarkdown(text) {
  const lines = text.split('\n');
  const tracks = [];

  for (const line of lines) {
    // Skip non-table rows and the header/separator rows
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // cells[0] is empty (before first |), cells[1]=Title, cells[2]=Artist(s), ...cells[5]=Added, cells[6]=Removed
    if (cells.length < 7) continue;

    const titleCell = cells[1];
    const artistCell = cells[2];
    const addedCell = cells[5];
    const removedCell = cells[6];

    // Skip header and separator rows
    if (titleCell === 'Title' || titleCell.startsWith('---')) continue;

    // Extract track name and URL from markdown link: [Name](URL)
    const titleMatch = titleCell.match(/^\[(.*)]\((https:\/\/open\.spotify\.com\/track\/(\w+))\)$/);
    if (!titleMatch) continue;

    const rawName = titleMatch[1];
    // Skip tracks with empty names
    if (!rawName) continue;

    const name = rawName.replace(/\\([.()])/g, '$1');
    const trackId = titleMatch[3];
    const openUrl = titleMatch[2];
    const uri = `spotify:track:${trackId}`;

    // Extract first artist name from markdown link: [Name](URL)
    const artistMatch = artistCell.match(/^\[([^\]]*)\]\(https:\/\/open\.spotify\.com\/artist\//);
    const rawArtist = artistMatch ? artistMatch[1] : 'Unknown';
    const artist = rawArtist.replace(/\\([.()])/g, '$1') || 'Unknown';

    // Parse dates
    const addedDate = addedCell ? new Date(addedCell + 'T00:00:00Z') : null;
    if (!addedDate || isNaN(addedDate.getTime())) continue;

    let removedDate = null;
    if (removedCell) {
      const parsed = new Date(removedCell + 'T00:00:00Z');
      if (!isNaN(parsed.getTime())) removedDate = parsed;
    }

    tracks.push({ id: trackId, name, artist, open_url: openUrl, uri, added: addedDate, removed: removedDate });
  }

  return tracks;
}

export function generateFridays(weeksBack) {
  const fridays = [];
  const now = new Date();
  const day = now.getDay();
  // Days since last Friday: Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=0, Sat=1
  const diff = (day + 2) % 7;
  const mostRecent = new Date(now);
  mostRecent.setDate(now.getDate() - diff);
  mostRecent.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeksBack; i++) {
    const friday = new Date(mostRecent);
    friday.setDate(mostRecent.getDate() - i * 7);
    fridays.push(friday);
  }

  return fridays;
}

export function reconstructPlaylist(allTracks, friday) {
  const fridayTime = friday.getTime();
  return allTracks.filter((t) => {
    if (t.added.getTime() > fridayTime) return false;
    if (t.removed && t.removed.getTime() <= fridayTime) return false;
    return true;
  });
}

export function formatTitle(region, friday) {
  const mm = String(friday.getMonth() + 1).padStart(2, '0');
  const dd = String(friday.getDate()).padStart(2, '0');
  const yyyy = friday.getFullYear();
  return `New.Music.Friday.${region}.${mm}.${dd}.${yyyy}`;
}

async function fetchCumulativeData(playlistId) {
  const url = CUMULATIVE_URL(playlistId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch cumulative data for ${playlistId}: ${response.status}`);
  }
  return response.text();
}

async function backfillRegion(region, playlistId) {
  console.log(`\nBackfilling ${region}...`);
  const text = await fetchCumulativeData(playlistId);
  const allTracks = parseCumulativeMarkdown(text);
  console.log(`  Parsed ${allTracks.length} cumulative tracks`);

  const fridays = generateFridays(BACKFILL_WEEKS);
  let created = 0;
  let skipped = 0;

  for (const friday of fridays) {
    const title = formatTitle(region, friday);
    const tracks = reconstructPlaylist(allTracks, friday);

    if (tracks.length === 0) {
      skipped++;
      continue;
    }

    const playlistTracks = tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
      open_url: t.open_url,
      uri: t.uri,
      added_at: t.added,
    }));

    await Playlist.findOneAndUpdate(
      { title, region },
      { title, region, published_date: friday, tracks: playlistTracks },
      { upsert: true, new: true }
    );
    created++;
  }

  console.log(`  ${region}: ${created} playlists upserted, ${skipped} empty weeks skipped`);
}

async function main() {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error('DB_URI environment variable is required');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(dbUri);
  console.log(`Connected. Backfilling ${BACKFILL_WEEKS} weeks for regions: ${BACKFILL_REGIONS.join(', ')}`);

  for (const region of BACKFILL_REGIONS) {
    const playlistId = PLAYLIST_IDS[region];
    if (!playlistId) {
      console.warn(`No playlist ID for region ${region}, skipping`);
      continue;
    }
    await backfillRegion(region, playlistId);
  }

  await mongoose.disconnect();
  console.log('\nBackfill complete.');
}

// Only run when executed directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''))) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
