import mongoose from 'mongoose';
import Playlist from '../models/playlist.js';
import { editionDate, dedupeAndSort } from '../lib/editions.js';
import { encodeJson, sendEncoded } from '../lib/encodedResponse.js';
import { indexCache, editionCache } from '../lib/archiveCache.js';

const notFound = res => res.status(404).json({ error: 'Not found' });

const INDEX_CACHE_CONTROL = 'public, max-age=300';
const EDITION_CACHE_CONTROL = 'public, max-age=3600';
const TUESDAY = /tuesday/i;

/** The index body: every edition without tracks, `tuesday: true` only on New Music Tuesday editions. */
export async function buildIndex() {
  // Project the track count, never the tracks: the full archive is ~134k rows.
  const rows = await Playlist.aggregate([
    {
      $project: {
        title: 1,
        region: 1,
        published_date: 1,
        trackCount: { $size: { $ifNull: ['$tracks', []] } },
      },
    },
  ]);

  const editions = rows.map(r => ({
    id: String(r._id),
    region: r.region || 'US',
    date: editionDate(r.title, r.published_date),
    trackCount: r.trackCount,
    tuesday: TUESDAY.test(r.title || ''),
    published_date: r.published_date,
  }));

  const items = dedupeAndSort(editions).map(({ published_date, tuesday, ...item }) =>
    (tuesday ? { ...item, tuesday: true } : item));
  return { items };
}

/** Build and encode the index now, so the first visitor after a start or a sync gets it from memory. */
export function warmIndex() {
  return indexCache.getOrFill('index', async () => encodeJson(await buildIndex()));
}

export async function index(req, res) {
  try {
    const entry = await warmIndex();
    sendEncoded(req, res, entry, { cacheControl: INDEX_CACHE_CONTROL });
  } catch (err) {
    console.error('Error listing editions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const trackUri = id => `spotify:track:${id}`;
const trackUrl = id => `https://open.spotify.com/track/${id}`;

/**
 * An edition's tracks as columns: `{ id: [...], name: [...], artist: [...] }`
 * in archive order. `uri` and `open_url` follow from the track id
 * (`spotify:track:<id>`, `https://open.spotify.com/track/<id>`), so they are
 * sent only when some track's stored value differs, and then as full columns.
 */
export function trackColumns(tracks = []) {
  const columns = {
    id: tracks.map(t => t.id ?? null),
    name: tracks.map(t => t.name ?? null),
    artist: tracks.map(t => t.artist ?? null),
  };
  if (tracks.some(t => t.uri !== trackUri(t.id))) columns.uri = tracks.map(t => t.uri ?? null);
  if (tracks.some(t => t.open_url !== trackUrl(t.id))) columns.open_url = tracks.map(t => t.open_url ?? null);
  // Sent only once some track has one, so editions not yet backfilled keep their smaller response.
  if (tracks.some(t => t.cover)) columns.cover = tracks.map(t => t.cover || null);
  return columns;
}

async function buildEdition(id) {
  const playlist = await Playlist.findById(id, { title: 1, region: 1, published_date: 1, 'tracks.id': 1, 'tracks.name': 1, 'tracks.artist': 1, 'tracks.uri': 1, 'tracks.open_url': 1, 'tracks.cover': 1 }).lean();
  if (!playlist) return null;
  return encodeJson({
    id: String(playlist._id),
    title: playlist.title,
    region: playlist.region || 'US',
    date: editionDate(playlist.title, playlist.published_date),
    tracks: trackColumns(playlist.tracks || []),
  });
}

export async function show(req, res) {
  try {
    // Check first: findById would throw a CastError (a 500) on a malformed id.
    if (!mongoose.isValidObjectId(req.params.id) || String(req.params.id).length !== 24) {
      return notFound(res);
    }
    const id = String(req.params.id).toLowerCase();
    const entry = await editionCache.getOrFill(id, () => buildEdition(id));
    if (!entry) return notFound(res);
    sendEncoded(req, res, entry, { cacheControl: EDITION_CACHE_CONTROL });
  } catch (err) {
    console.error('Error loading edition:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
