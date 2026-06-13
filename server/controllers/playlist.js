import Playlist from '../models/playlist.js';
import { VALID_REGIONS } from '../lib/regions.js';

export async function list(req, res) {
  try {
    const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 5));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const sortDir = req.query.sort === 'desc' ? -1 : 1;
    const skip = (page - 1) * size;

    const filter = {};
    if (req.query.region && VALID_REGIONS.includes(req.query.region)) {
      filter.region = req.query.region;
    }

    const [count, items] = await Promise.all([
      Playlist.countDocuments(filter),
      // Order same-date playlists by region to match the menu order in
      // VALID_REGIONS (US, UK, CA, BR, MX, DE) rather than insertion order.
      Playlist.aggregate([
        { $match: filter },
        { $addFields: { _regionRank: { $indexOfArray: [VALID_REGIONS, '$region'] } } },
        { $sort: { published_date: sortDir, _regionRank: 1 } },
        { $skip: skip },
        { $limit: size },
        { $project: { _regionRank: 0 } },
      ]),
    ]);

    res.json({ count, items });
  } catch (err) {
    console.error('Error listing playlists:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
