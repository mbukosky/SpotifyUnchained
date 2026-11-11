// Pure logic behind the Friday Wall. Nothing here touches the DOM or React,
// so every rule the wall depends on can be pinned down in wall.test.js.
//
// Edition dates arrive from the API as plain calendar dates ('YYYY-MM-DD').
// They are never passed to `new Date(string)`, which reads them as UTC
// midnight and shows the day before anywhere west of UTC.

import { REGIONS } from './regions';

const DAY_MS = 864e5;
const LONG_DATE = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
const MONTH_DATE = { year: 'numeric', month: 'long', day: 'numeric' };

// Region order for anything listed per region (ALL week panels, ties).
export const EDITION_REGIONS = REGIONS.filter(r => r !== 'ALL');

/** 'YYYY-MM-DD' → Date at local midnight. */
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days since the epoch, ignoring time zones and DST. */
function dayNumber(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

// One formatter per format, and each date formatted once: the wall labels
// ~640 tiles on every render of a region, and creating a formatter per call
// (which toLocaleDateString does) dominated that cost.
const longFormat = new Intl.DateTimeFormat('en-US', LONG_DATE);
const monthFormat = new Intl.DateTimeFormat('en-US', MONTH_DATE);
const longDates = new Map();

/** "Saturday, February 14, 2026" */
export function formatLongDate(s) {
  let text = longDates.get(s);
  if (text === undefined) {
    text = longFormat.format(parseDate(s));
    longDates.set(s, text);
  }
  return text;
}

/** "February 14, 2026" */
export function formatMonthDate(s) {
  return monthFormat.format(parseDate(s));
}

/** ISO 8601 week of a date: weeks start on Monday, week 1 holds the first Thursday. */
export function isoWeek(s) {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday); // the Thursday of this week
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return { year, week };
}

/** Key of the ISO week a date falls in, e.g. "2026-W07". Tiles use it as their key. */
export function weekKey(s) {
  const { year, week } = isoWeek(s);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Where a date sits on the wall: the row is its calendar year and the column
 * is the Monday-to-Sunday week of that year, counting the week holding
 * January 1 as column 0. This is the ISO week shifted so that a late-December
 * edition that ISO files under next year's week 1 lands in the last column,
 * and an early-January edition filed under last year's week 52/53 lands in
 * the first, which keeps every row's year label true to the dates in it.
 */
export function wallPosition(s) {
  const year = Number(s.slice(0, 4));
  const jan1 = `${year}-01-01`;
  const mondayOffset = (parseDate(jan1).getDay() + 6) % 7;
  const column = Math.floor((dayNumber(s) - dayNumber(jan1) + mondayOffset) / 7);
  return { year, column };
}

/** Number of week positions in a year's row (53, or 54 in a leap year starting on Sunday). */
export function columnsInYear(year) {
  return wallPosition(`${year}-12-31`).column + 1;
}

/** Sort editions by date, then by region order. Returns a new array. */
export function sortEditions(editions) {
  const order = (r) => {
    const i = EDITION_REGIONS.indexOf(r);
    return i === -1 ? EDITION_REGIONS.length : i;
  };
  return [...editions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : order(a.region) - order(b.region));
}

/**
 * One tile per ISO week for a single region. When two editions share a week
 * (the 2015 Tuesday-to-Friday switch), the later one stands for it.
 * `editions` must be one region's editions sorted by date.
 */
export function regionTiles(editions) {
  const byWeek = new Map();
  for (const e of editions) byWeek.set(weekKey(e.date), e); // later overwrites earlier
  return [...byWeek.entries()].map(([key, e]) => ({
    key,
    date: e.date,
    editions: [e],
    value: e.trackCount,
    trackCount: e.trackCount,
  }));
}

/**
 * One tile per ISO week across every region, for the ALL wall. Each tile
 * keeps the latest edition of each region that week, in region order, and is
 * dated by the latest of them. Its brightness value is the region count.
 * `editions` must be sorted by date.
 */
export function weekTiles(editions) {
  const byWeek = new Map();
  for (const e of editions) {
    const key = weekKey(e.date);
    if (!byWeek.has(key)) byWeek.set(key, new Map());
    byWeek.get(key).set(e.region, e);
  }
  return [...byWeek.entries()].map(([key, perRegion]) => {
    const list = EDITION_REGIONS.filter(r => perRegion.has(r)).map(r => perRegion.get(r));
    const date = list.reduce((latest, e) => (e.date > latest ? e.date : latest), list[0].date);
    return {
      key,
      date,
      editions: list,
      value: list.length,
      trackCount: list.reduce((sum, e) => sum + e.trackCount, 0),
    };
  });
}

/** Value at a percentile (0–1) of a list, nearest-rank. */
export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank];
}

/**
 * Map each value onto four brightness steps (0–3) spread between the 5th and
 * 95th percentile. Using the extremes instead let a few unusual weeks stretch
 * the range so far that every recent tile came out the same shade.
 */
export function brightnessSteps(values) {
  const lo = percentile(values, 0.05);
  const hi = percentile(values, 0.95);
  return values.map(v => {
    if (hi <= lo) return 3;
    const t = (v - lo) / (hi - lo);
    return Math.min(3, Math.max(0, Math.floor(t * 4)));
  });
}

/**
 * Lay tiles out as year rows, newest year first, each with one slot per week
 * column. Rows exist only for years that hold a tile. Each placed tile gains
 * `year`, `column` and `step`; empty slots are null.
 */
export function layoutWall(tiles) {
  const steps = brightnessSteps(tiles.map(t => t.value));
  const byYear = new Map();
  tiles.forEach((tile, i) => {
    const { year, column } = wallPosition(tile.date);
    const placed = { ...tile, year, column, step: steps[i] };
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(placed);
  });
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const rows = years.map(year => {
    const slots = Array.from({ length: columnsInYear(year) }, () => null);
    for (const tile of byYear.get(year)) slots[tile.column] = tile;
    return { year, slots };
  });
  const columns = rows.reduce((max, r) => Math.max(max, r.slots.length), 0);
  return { rows, columns };
}

/**
 * The edition nearest a date. When two are equally near, the later one wins.
 * `editions` must be sorted by date. Returns null for an empty list.
 */
export function nearestEdition(editions, dateStr) {
  const target = dayNumber(dateStr);
  let best = null;
  let bestDistance = Infinity;
  for (const e of editions) {
    const distance = Math.abs(dayNumber(e.date) - target);
    // At equal distance only a strictly later date replaces the best, so two
    // regions sharing a date resolve to the first in region order.
    if (distance < bestDistance || (distance === bestDistance && e.date > best.date)) {
      best = e;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The editions before and after `id` within its own region, by date. Works on
 * the full list, so an edition that lost its week's tile is still reachable.
 */
export function adjacentEditions(editions, id) {
  const current = editions.find(e => e.id === id);
  if (!current) return { previous: null, next: null };
  const same = editions.filter(e => e.region === current.region);
  const i = same.indexOf(current);
  return { previous: same[i - 1] || null, next: same[i + 1] || null };
}

/** Numbers for "N Fridays. T tracks. Since Month day, year." */
export function headlineNumbers(tiles) {
  if (tiles.length === 0) return null;
  let since = tiles[0].editions[0].date;
  let tracks = 0;
  for (const tile of tiles) {
    tracks += tile.trackCount;
    for (const e of tile.editions) if (e.date < since) since = e.date;
  }
  return { fridays: tiles.length, tracks, since };
}

/** The headline sentence itself. */
export function headlineText({ fridays, tracks, since }) {
  return `${fridays.toLocaleString('en-US')} Fridays. ${tracks.toLocaleString('en-US')} tracks. Since ${formatMonthDate(since)}.`;
}

/** The tile's accessible name. */
export function tileLabel(tile, allRegions) {
  if (allRegions) {
    const n = tile.editions.length;
    return `Week of ${formatLongDate(tile.date)}, ${n} ${n === 1 ? 'region' : 'regions'}`;
  }
  const n = tile.trackCount;
  return `${formatLongDate(tile.date)}, ${n} ${n === 1 ? 'track' : 'tracks'}`;
}

/** Index of the column where each month starts, for the wall's month labels. */
export function monthColumns(year) {
  return Array.from({ length: 12 }, (_, m) =>
    wallPosition(`${year}-${String(m + 1).padStart(2, '0')}-01`).column);
}
