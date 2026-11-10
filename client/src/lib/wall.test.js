import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatLongDate,
  formatMonthDate,
  isoWeek,
  wallPosition,
  columnsInYear,
  sortEditions,
  regionTiles,
  weekTiles,
  percentile,
  brightnessSteps,
  layoutWall,
  nearestEdition,
  adjacentEditions,
  headlineNumbers,
  headlineText,
  tileLabel,
  monthColumns,
} from './wall';

let nextId = 0;
const ed = (date, region = 'US', trackCount = 30) => ({
  id: `e${++nextId}`,
  title: `New.Music.Friday.${region}.${date}`,
  region,
  date,
  trackCount,
});

describe('parseDate', () => {
  it('builds local midnight, not UTC midnight', () => {
    const d = parseDate('2026-02-14');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 1, 14]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe('date formatting', () => {
  it('formats the weekday, month, day and year', () => {
    expect(formatLongDate('2026-02-14')).toBe('Saturday, February 14, 2026');
    expect(formatLongDate('2015-07-07')).toBe('Tuesday, July 7, 2015');
  });

  it('formats the headline date without a weekday', () => {
    expect(formatMonthDate('2014-07-22')).toBe('July 22, 2014');
  });
});

describe('isoWeek', () => {
  it('puts a Tuesday and the Friday after it in the same week', () => {
    expect(isoWeek('2015-07-07')).toEqual(isoWeek('2015-07-10'));
  });

  it('numbers the 53rd week of a 53-week year', () => {
    expect(isoWeek('2015-12-31')).toEqual({ year: 2015, week: 53 });
    expect(isoWeek('2020-12-31')).toEqual({ year: 2020, week: 53 });
    expect(isoWeek('2026-12-31')).toEqual({ year: 2026, week: 53 });
  });

  it('files late December under next year and early January under last year', () => {
    expect(isoWeek('2014-12-30')).toEqual({ year: 2015, week: 1 });
    expect(isoWeek('2021-01-01')).toEqual({ year: 2020, week: 53 });
  });

  it('treats Sunday as the end of the week', () => {
    expect(isoWeek('2026-02-15')).toEqual(isoWeek('2026-02-09'));
    expect(isoWeek('2026-02-16').week).toBe(isoWeek('2026-02-15').week + 1);
  });
});

describe('wallPosition', () => {
  it('keeps a late-December edition in its own year, in the last column', () => {
    const pos = wallPosition('2014-12-30');
    expect(pos.year).toBe(2014);
    expect(pos.column).toBe(columnsInYear(2014) - 1);
  });

  it('keeps an early-January edition in its own year, in the first column', () => {
    expect(wallPosition('2021-01-01')).toEqual({ year: 2021, column: 0 });
    // The next Friday is ISO week 1 and gets its own column.
    expect(wallPosition('2021-01-08')).toEqual({ year: 2021, column: 1 });
  });

  it('places a 53-week year across 53 columns', () => {
    expect(columnsInYear(2015)).toBe(53);
    expect(wallPosition('2015-12-31').column).toBe(52);
    expect(wallPosition('2015-01-02').column).toBe(0);
  });

  it('gives each week of a year its own column', () => {
    const cols = ['2026-02-06', '2026-02-13', '2026-02-20'].map(d => wallPosition(d).column);
    expect(cols[1] - cols[0]).toBe(1);
    expect(cols[2] - cols[1]).toBe(1);
  });
});

describe('sortEditions', () => {
  it('orders by date, then by region order', () => {
    const list = [ed('2026-02-14', 'AU'), ed('2026-02-07', 'UK'), ed('2026-02-14', 'US'), ed('2026-02-14', 'DE')];
    expect(sortEditions(list).map(e => `${e.date} ${e.region}`)).toEqual([
      '2026-02-07 UK', '2026-02-14 US', '2026-02-14 DE', '2026-02-14 AU',
    ]);
  });
});

describe('regionTiles', () => {
  it('lets the later edition stand for a shared week (July 2015)', () => {
    const tue = ed('2015-07-07', 'US', 49);
    const fri = ed('2015-07-10', 'US', 51);
    const tiles = regionTiles([ed('2015-06-30'), tue, fri, ed('2015-07-17')]);
    expect(tiles).toHaveLength(3);
    const shared = tiles.find(t => t.editions.includes(fri));
    expect(shared.date).toBe('2015-07-10');
    expect(shared.trackCount).toBe(51);
    expect(tiles.some(t => t.editions.includes(tue))).toBe(false);
  });
});

describe('weekTiles', () => {
  it('groups every region of a week into one tile in region order', () => {
    const regions = ['AU', 'DE', 'MX', 'BR', 'CA', 'UK', 'US'];
    const list = sortEditions(regions.map(r => ed('2026-02-14', r, 10)));
    const [tile] = weekTiles(list);
    expect(tile.editions.map(e => e.region)).toEqual(['US', 'UK', 'CA', 'BR', 'MX', 'DE', 'AU']);
    expect(tile.value).toBe(7);
    expect(tile.trackCount).toBe(70);
    expect(tileLabel(tile, true)).toBe('Week of Saturday, February 14, 2026, 7 regions');
  });

  it('dates the tile by the latest edition and keeps each region\'s later edition', () => {
    const list = sortEditions([ed('2015-07-07', 'US'), ed('2015-07-08', 'UK'), ed('2015-07-10', 'US')]);
    const [tile] = weekTiles(list);
    expect(tile.date).toBe('2015-07-10');
    expect(tile.editions.map(e => e.date)).toEqual(['2015-07-10', '2015-07-08']);
  });
});

describe('percentile and brightnessSteps', () => {
  it('takes the nearest-rank percentile', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 0.05)).toBe(5);
    expect(percentile(values, 0.95)).toBe(95);
    expect(percentile([], 0.5)).toBe(0);
  });

  it('spreads values over four steps between the 5th and 95th percentile', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const steps = brightnessSteps(values);
    expect(steps[0]).toBe(0);
    expect(steps[99]).toBe(3);
    expect(new Set(steps)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('does not let a few outliers flatten the rest', () => {
    // Three 2014-style 30-track weeks among a hundred 80–119-track weeks.
    const values = [...Array(3).fill(30), ...Array.from({ length: 100 }, (_, i) => 80 + (i % 40))];
    const steps = brightnessSteps(values).slice(3);
    expect(new Set(steps)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('draws every tile at full brightness when all values match', () => {
    expect(brightnessSteps([12, 12, 12])).toEqual([3, 3, 3]);
  });

  it('gives more tracks a brighter or equal step', () => {
    const steps = brightnessSteps([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
  });
});

describe('layoutWall', () => {
  it('runs rows newest first and only for years with editions', () => {
    const { rows } = layoutWall(regionTiles([ed('2024-03-01'), ed('2025-03-07'), ed('2026-03-06')]));
    expect(rows.map(r => r.year)).toEqual([2026, 2025, 2024]);
  });

  it('leaves an empty slot for a missing week', () => {
    const list = [ed('2026-02-07'), ed('2026-02-21')];
    const { rows } = layoutWall(regionTiles(list));
    const [row] = rows;
    const a = row.slots.findIndex(s => s?.date === '2026-02-07');
    const b = row.slots.findIndex(s => s?.date === '2026-02-21');
    expect(b - a).toBe(2);
    expect(row.slots[a + 1]).toBeNull();
  });

  it('draws a 53-week year with a tile in its 53rd column', () => {
    const { rows, columns } = layoutWall(regionTiles([ed('2015-01-02'), ed('2015-12-31')]));
    expect(columns).toBe(53);
    expect(rows[0].slots).toHaveLength(53);
    expect(rows[0].slots[52].date).toBe('2015-12-31');
    expect(rows[0].slots[0].date).toBe('2015-01-02');
  });

  it('keeps the December edge week in its calendar year\'s row', () => {
    const { rows } = layoutWall(regionTiles([ed('2014-12-30'), ed('2015-01-06')]));
    expect(rows.map(r => r.year)).toEqual([2015, 2014]);
    expect(rows[1].slots.at(-1).date).toBe('2014-12-30');
  });

  it('attaches a brightness step to every tile', () => {
    const { rows } = layoutWall(regionTiles([ed('2026-01-02', 'US', 10), ed('2026-01-09', 'US', 100)]));
    const tiles = rows[0].slots.filter(Boolean);
    expect(tiles[0].step).toBeLessThan(tiles[1].step);
  });
});

describe('nearestEdition', () => {
  it('opens the nearest edition (spec: Nearest edition opens)', () => {
    const list = [ed('2026-02-07'), ed('2026-02-14')];
    expect(nearestEdition(list, '2026-02-12').date).toBe('2026-02-14');
  });

  it('chooses the later edition when two are equally near', () => {
    const list = [ed('2026-02-07'), ed('2026-02-14')];
    expect(nearestEdition(list, '2026-02-10').date).toBe('2026-02-07'); // 3 days vs 4
    const tie = [ed('2026-02-06'), ed('2026-02-14')];
    expect(nearestEdition(tie, '2026-02-10').date).toBe('2026-02-14');
  });

  it('clamps to the ends of the archive', () => {
    const list = [ed('2020-01-03'), ed('2026-02-14')];
    expect(nearestEdition(list, '1999-01-01').date).toBe('2020-01-03');
    expect(nearestEdition(list, '2099-01-01').date).toBe('2026-02-14');
  });

  it('is not thrown off by a daylight saving change', () => {
    const list = [ed('2026-03-06'), ed('2026-03-13')];
    // 8 March 2026 is the US spring-forward date.
    expect(nearestEdition(list, '2026-03-09').date).toBe('2026-03-06');
    expect(nearestEdition(list, '2026-03-10').date).toBe('2026-03-13');
  });

  it('returns null for an empty archive', () => {
    expect(nearestEdition([], '2026-02-12')).toBeNull();
  });
});

describe('adjacentEditions', () => {
  const us1 = ed('2026-02-06', 'US');
  const uk1 = ed('2026-02-06', 'UK');
  const usTue = ed('2026-02-10', 'US');
  const us2 = ed('2026-02-13', 'US');
  const uk2 = ed('2026-02-13', 'UK');
  const list = [us1, uk1, usTue, us2, uk2];

  it('steps within the same region only', () => {
    expect(adjacentEditions(list, uk2.id)).toEqual({ previous: uk1, next: null });
  });

  it('reaches an edition that has no tile of its own', () => {
    expect(adjacentEditions(list, us2.id).previous).toBe(usTue);
    expect(adjacentEditions(list, us1.id)).toEqual({ previous: null, next: usTue });
  });

  it('returns nothing for an unknown id', () => {
    expect(adjacentEditions(list, 'nope')).toEqual({ previous: null, next: null });
  });
});

describe('headline', () => {
  it('counts tiles, sums their tracks and finds the earliest date', () => {
    const list = Array.from({ length: 52 }, (_, i) => {
      const d = new Date(2025, 1, 21 + i * 7);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return ed(s, 'UK', 100);
    });
    const numbers = headlineNumbers(regionTiles(list));
    expect(numbers).toEqual({ fridays: 52, tracks: 5200, since: '2025-02-21' });
    expect(headlineText(numbers)).toBe('52 Fridays. 5,200 tracks. Since February 21, 2025.');
  });

  it('counts only the tracks of editions that stand for a tile', () => {
    const numbers = headlineNumbers(regionTiles([ed('2015-07-07', 'US', 49), ed('2015-07-10', 'US', 51)]));
    expect(numbers).toEqual({ fridays: 1, tracks: 51, since: '2015-07-10' });
  });

  it('counts every region\'s tracks on the ALL wall', () => {
    const list = sortEditions([ed('2026-02-13', 'US', 100), ed('2026-02-13', 'UK', 80), ed('2026-02-20', 'US', 90)]);
    expect(headlineNumbers(weekTiles(list))).toEqual({ fridays: 2, tracks: 270, since: '2026-02-13' });
  });

  it('uses thousands separators', () => {
    expect(headlineText({ fridays: 1312, tracks: 134000, since: '2014-07-22' }))
      .toBe('1,312 Fridays. 134,000 tracks. Since July 22, 2014.');
  });

  it('has no headline for an empty wall', () => {
    expect(headlineNumbers([])).toBeNull();
  });
});

describe('tileLabel', () => {
  it('names a region tile for its date and track count (spec example)', () => {
    const [tile] = regionTiles([ed('2026-02-14', 'US', 30)]);
    expect(tileLabel(tile, false)).toBe('Saturday, February 14, 2026, 30 tracks');
  });
});

describe('monthColumns', () => {
  it('starts January in column 0 and runs in order', () => {
    const cols = monthColumns(2026);
    expect(cols[0]).toBe(0);
    for (let i = 1; i < 12; i++) expect(cols[i]).toBeGreaterThan(cols[i - 1]);
    expect(cols[11]).toBeLessThan(columnsInYear(2026));
  });
});
