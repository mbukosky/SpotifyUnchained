// Pure helpers for the edition panel's cover grid and player bar.

// Backfilled names carry markdown escapes ("Sorte \- Ao Vivo").
export const clean = (s = '') => String(s).replace(/\\(.)/g, '$1');

// Two-digit, one-based playlist position: 0 → "01".
export const position = (index) => String(index + 1).padStart(2, '0');

export const tileLabel = (track) => `Play ${clean(track.name)} by ${clean(track.artist)}`;

// The first credited artist of "A, B", "A & B", "A feat. B", "A x B" or "A with B".
export function leadArtist(artist = '') {
  const name = clean(artist);
  return name.split(/,|&|\s+feat\.?\s+|\s+ft\.\s+|\s+x\s+|\s+with\s+/i)[0].trim() || name.trim();
}

// Two letters for a tile with no cover: the first letters of the lead
// artist's first two words, or the first two letters of a one-word name.
export function initials(artist = '') {
  const words = leadArtist(artist)
    .split(/\s+/)
    .map(w => [...w].filter(c => /[\p{L}\p{N}]/u.test(c)).join(''))
    .filter(Boolean);
  if (!words.length) return '♪';
  if (words.length === 1) {
    const [a = '', b = ''] = [...words[0]];
    return a.toUpperCase() + b.toLowerCase();
  }
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

// FNV-1a, so one artist always gets the same hue.
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hexToHue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 250;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 250;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

// Hue offsets around the region accent: analogous first, then a few
// complementary pops, so a page of tiles reads as one family.
const OFFSETS = [0, 26, -26, 52, -52, 84, -84, 150, 180, -150];
const cache = new Map();

/**
 * The fallback color for an artist in a region: `{ hue, color, gradient }`.
 * The hue is the region accent's, shifted by a hash of the lead artist's name.
 */
export function artistColor(artist, accent) {
  const name = leadArtist(artist).toLowerCase();
  const key = `${accent}|${name}`;
  let c = cache.get(key);
  if (c) return c;
  const h = hash(name);
  const hue = Math.round((hexToHue(accent) + OFFSETS[h % OFFSETS.length] + ((h >>> 8) % 16) - 8 + 720) % 360);
  const sat = 70 + ((h >>> 12) % 3) * 9;
  const lit = 60 + ((h >>> 16) % 4) * 4;
  const hue2 = (hue + 34) % 360;
  c = {
    hue,
    color: `hsl(${hue} ${sat}% ${lit}%)`,
    gradient: `linear-gradient(140deg, hsl(${hue} ${sat}% ${lit + 6}%), hsl(${hue2} ${sat}% ${lit - 20}%))`,
  };
  cache.set(key, c);
  return c;
}

/**
 * Where a key moves focus in a wrapping grid `columns` wide holding `count`
 * tiles, or null for a key the grid does not handle. Up from the first row
 * stays put; down into a short last row lands on the last tile.
 */
export function moveIndex(index, key, columns, count) {
  const last = count - 1;
  switch (key) {
    case 'ArrowLeft': return Math.max(0, index - 1);
    case 'ArrowRight': return Math.min(last, index + 1);
    case 'ArrowUp': return index - columns >= 0 ? index - columns : index;
    case 'ArrowDown': return Math.min(last, index + columns);
    case 'Home': return 0;
    case 'End': return last;
    default: return null;
  }
}
