import { describe, it, expect } from 'vitest';
import { PLAYLIST_IDS, VALID_REGIONS } from './regions.js';
import { REGIONS, REGION_COLORS } from '../../client/src/lib/regions.js';

// The client keeps its own copy of the region list; adding a region on one
// side only would silently hide it from the menu or the sync.
describe('regions', () => {
  it('client menu matches server regions, in order, after ALL', () => {
    expect(REGIONS).toEqual(['ALL', ...VALID_REGIONS]);
  });

  it('every server region has a client accent color', () => {
    expect(Object.keys(REGION_COLORS)).toEqual(VALID_REGIONS);
  });

  it('archives the shared AU & NZ playlist under AU', () => {
    expect(PLAYLIST_IDS.AU).toBe('37i9dQZF1DWT2SPAYawYcO');
  });
});
