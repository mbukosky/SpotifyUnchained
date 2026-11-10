import { VALID_REGIONS } from './regions.js';

const DOTTED = /(\d{2})\.(\d{2})\.(\d{4})\s*$/;
const ISO = /(\d{4})-(\d{2})-(\d{2})/;

// Reject things like 13.45.2025 so a stray number in a title can't win over the
// published_date fallback.
function isRealDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = n => String(n).padStart(2, '0');

// published_date is unreliable for placing an edition: older rows store the
// archive time (about six days late) and newer ones store midnight UTC. The
// title carries the real date, so prefer it and fall back to the UTC date.
export function editionDate(title, publishedDate) {
  const text = typeof title === 'string' ? title : '';

  const dotted = DOTTED.exec(text);
  if (dotted) {
    const [m, d, y] = [+dotted[1], +dotted[2], +dotted[3]];
    if (isRealDate(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
  }

  const iso = ISO.exec(text);
  if (iso) {
    const [y, m, d] = [+iso[1], +iso[2], +iso[3]];
    if (isRealDate(y, m, d)) return `${y}-${pad(m)}-${pad(d)}`;
  }

  return new Date(publishedDate).toISOString().slice(0, 10);
}

const time = v => new Date(v).getTime();

// Keep one edition per region and date: the one with the most tracks, then the
// latest published_date. Returns them ordered by date, then VALID_REGIONS order.
// Each edition needs { region, date, trackCount, published_date }.
export function dedupeAndSort(editions) {
  const best = new Map();
  for (const e of editions) {
    const key = `${e.region}|${e.date}`;
    const cur = best.get(key);
    if (
      !cur ||
      e.trackCount > cur.trackCount ||
      (e.trackCount === cur.trackCount && time(e.published_date) > time(cur.published_date))
    ) {
      best.set(key, e);
    }
  }
  const rank = r => VALID_REGIONS.indexOf(r);
  return [...best.values()].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a.region) - rank(b.region)),
  );
}
