import Playlist from '../models/playlist.js';
import { VALID_REGIONS } from '../lib/regions.js';
import { encodeJson, sendEncoded } from '../lib/encodedResponse.js';
import { listCache } from '../lib/archiveCache.js';

/** The page, size, sort and region a list request asks for, with defaults and limits applied. */
export function listQuery(query = {}) {
  const size = Math.min(100, Math.max(1, parseInt(query.size, 10) || 5));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const sortDir = query.sort === 'desc' ? -1 : 1;
  const region = query.region && VALID_REGIONS.includes(query.region) ? query.region : null;
  return { size, page, sortDir, region };
}

/** The list body `{ count, items }` for a normalised query. */
export async function buildList({ size, page, sortDir, region }) {
  const skip = (page - 1) * size;
  const filter = region ? { region } : {};

  const [count, items] = await Promise.all([
    Playlist.countDocuments(filter),
    // Order same-date playlists by region to match the menu order in
    // VALID_REGIONS (US, UK, CA, BR, MX, DE, AU) rather than insertion order.
    Playlist.aggregate([
      { $match: filter },
      { $addFields: { _regionRank: { $indexOfArray: [VALID_REGIONS, '$region'] } } },
      { $sort: { published_date: sortDir, _regionRank: 1 } },
      { $skip: skip },
      { $limit: size },
      { $project: { _regionRank: 0 } },
    ]),
  ]);

  return { count, items };
}

// The response is the same JSON `res.json` would send; it is encoded once and
// kept briefly in memory, so repeat requests skip the database and compression.
export async function list(req, res) {
  try {
    const q = listQuery(req.query);
    const key = `${q.page}|${q.size}|${q.sortDir}|${q.region || ''}`;
    const entry = await listCache.getOrFill(key, async () => encodeJson(await buildList(q)));
    sendEncoded(req, res, entry);
  } catch (err) {
    console.error('Error listing playlists:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
