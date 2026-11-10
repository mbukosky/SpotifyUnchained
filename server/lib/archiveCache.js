import { EncodedCache } from './encodedResponse.js';

// Encoded API responses kept in memory. Archived editions never change after
// their week, the index changes only when a sync writes, and the list API is
// a view of the same data, so every cache is cleared by `invalidateArchive()`
// (called after each sync write). The time limits cover writers in other
// processes, such as the backfill script.
export const indexCache = new EncodedCache({ max: 1, ttlMs: 5 * 60 * 1000 });
export const editionCache = new EncodedCache({ max: 400, ttlMs: 60 * 60 * 1000 });
export const listCache = new EncodedCache({ max: 100, ttlMs: 60 * 1000 });

export function invalidateArchive() {
  indexCache.clear();
  editionCache.clear();
  listCache.clear();
}
