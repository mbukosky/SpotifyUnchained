import mongoose from 'mongoose';
import Playlist from '../models/playlist.js';
import { editionDate, dedupeAndSort } from '../lib/editions.js';

const notFound = res => res.status(404).json({ error: 'Not found' });

export async function index(req, res) {
  try {
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
      title: r.title,
      region: r.region || 'US',
      date: editionDate(r.title, r.published_date),
      trackCount: r.trackCount,
      published_date: r.published_date,
    }));

    const items = dedupeAndSort(editions).map(({ published_date, ...item }) => item);

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ items });
  } catch (err) {
    console.error('Error listing editions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function show(req, res) {
  try {
    // Check first: findById would throw a CastError (a 500) on a malformed id.
    if (!mongoose.isValidObjectId(req.params.id) || String(req.params.id).length !== 24) {
      return notFound(res);
    }

    const playlist = await Playlist.findById(req.params.id).lean();
    if (!playlist) return notFound(res);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      id: String(playlist._id),
      title: playlist.title,
      region: playlist.region || 'US',
      date: editionDate(playlist.title, playlist.published_date),
      tracks: (playlist.tracks || []).map(t => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
        open_url: t.open_url,
        uri: t.uri,
        added_at: t.added_at,
      })),
    });
  } catch (err) {
    console.error('Error loading edition:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
