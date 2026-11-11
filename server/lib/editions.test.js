import { describe, it, expect } from 'vitest';
import { editionDate, dedupeAndSort } from './editions.js';

describe('editionDate', () => {
  it('reads a dotted title, ignoring published_date', () => {
    expect(editionDate('New.Music.Friday.11.07.2025', new Date('2025-11-13T10:00:00Z'))).toBe('2025-11-07');
    expect(editionDate('New.Music.Friday.UK.02.06.2026', '2026-02-12T00:00:00Z')).toBe('2026-02-06');
  });

  it('reads a leading ISO date', () => {
    expect(editionDate('2014-12-30 New Music Tuesday', new Date('2015-01-05T00:00:00Z'))).toBe('2014-12-30');
  });

  it('falls back to the UTC date of published_date', () => {
    expect(editionDate('Some title', new Date('2026-02-14T00:00:00Z'))).toBe('2026-02-14');
    // 23:30 UTC stays on its UTC day whatever the server time zone
    expect(editionDate('', new Date('2026-02-14T23:30:00Z'))).toBe('2026-02-14');
    expect(editionDate(undefined, new Date('2026-02-14T00:00:00Z'))).toBe('2026-02-14');
  });

  it('ignores impossible dates in the title', () => {
    expect(editionDate('New.Music.Friday.13.45.2025', new Date('2025-03-07T00:00:00Z'))).toBe('2025-03-07');
  });
});

const ed = (region, date, trackCount, published) => ({
  region, date, trackCount, published_date: new Date(published),
});

describe('dedupeAndSort', () => {
  it('keeps one edition per region and date: most tracks, then latest published_date', () => {
    const older = ed('US', '2026-02-06', 100, '2026-02-06T00:00:00Z');
    const newer = ed('US', '2026-02-06', 100, '2026-02-12T00:00:00Z');
    expect(dedupeAndSort([newer, older])).toEqual([newer]);
    expect(dedupeAndSort([older, newer])).toEqual([newer]);
    const bigger = ed('US', '2026-02-06', 120, '2026-01-01T00:00:00Z');
    expect(dedupeAndSort([newer, bigger])).toEqual([bigger]);
  });

  it('does not merge different regions', () => {
    const out = dedupeAndSort([ed('US', '2026-02-06', 1, '2026-02-06'), ed('UK', '2026-02-06', 1, '2026-02-06')]);
    expect(out).toHaveLength(2);
  });

  it('orders by date, then region order', () => {
    const out = dedupeAndSort([
      ed('UK', '2026-02-14', 1, '2026-02-14'),
      ed('US', '2026-02-14', 1, '2026-02-14'),
      ed('US', '2026-02-07', 1, '2026-02-07'),
    ]);
    expect(out.map(e => `${e.date} ${e.region}`)).toEqual([
      '2026-02-07 US', '2026-02-14 US', '2026-02-14 UK',
    ]);
  });
});
