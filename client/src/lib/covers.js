// Track cover art, looked up in the browser from Spotify's public oEmbed
// endpoint. Lookups are lazy: tiles on screen first, top to bottom, then
// tiles within about 400 pixels of the viewport; a few lookups are in flight
// at a time. Found covers are kept for the life of the page and, bounded and
// with an expiry, in localStorage, so a reopened edition paints its covers
// without lookups. A failed lookup is cached as null (for this page only) so
// the tile keeps its fallback; it may be asked for again after a minute (on
// hover, or when its edition is reopened). Spotify limits requests per
// visitor, and the player embed shares that limit, so a 429 stops all lookups
// for a while (30 seconds, doubling up to five minutes), keeps the unanswered
// tiles queued, and then resumes with one lookup at a time. A dropped
// connection pauses the queue the same way, for a shorter time, so one
// failure does not burn through every queued lookup.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const MAX_IN_FLIGHT = 6;
const RETRY_AFTER_MS = 60_000;
const PAUSE_429_MS = 30_000; // first pause after a 429; doubles while 429s continue
const PAUSE_DROPPED_MS = 5_000; // first pause after a dropped connection
const PAUSE_MAX_MS = 300_000;

// Priority tiers: 0 = on screen (or hovered, or playing), 1 = near the viewport.
const ON_SCREEN = 0;
const NEAR = 1;

const covers = new Map(); // track id → thumbnail URL, or null when the lookup failed
const failedAt = new Map(); // track id → time of the last failed lookup
const queued = new Map(); // track id → tier it is queued at
const queues = [[], []]; // per tier, oldest first; stale entries are skipped
const sent = new Set(); // track ids with a lookup in flight
const listeners = new Map(); // track id → Set of callbacks
let inFlight = 0;
let maxInFlight = MAX_IN_FLIGHT;

const oembedUrl = (id) =>
  `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`;

// ---------------------------------------------------------------------------
// Persistence: id → cover URL across visits. Only Spotify image-CDN URLs are
// kept, written compactly ("id host path day" per line), at most STORE_MAX
// entries, each for STORE_TTL_DAYS. Every storage access is wrapped, so a
// blocked or full storage just means no persistence.

const STORE_KEY = 'su:covers:v1';
const STORE_MAX = 2000;
const STORE_TTL_DAYS = 30;
const IMAGE_URL = /^https:\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/image\/([0-9a-f]{40})$/;

const savedOn = new Map(); // track id → day number it was looked up (persisted entries only)
let storeLoaded = false;
let saveTimer = null;
const today = () => Math.floor(Date.now() / 864e5);

function loadStore() {
  if (storeLoaded) return;
  storeLoaded = true;
  let raw = null;
  try {
    raw = globalThis.localStorage?.getItem(STORE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  const oldest = today() - STORE_TTL_DAYS;
  for (const line of raw.split('\n')) {
    const [id, host, path, day] = line.split(' ');
    const d = Number(day);
    if (!id || !host || !path || !(d > oldest) || covers.get(id)) continue;
    const url = `https://${host}/image/${path}`;
    if (!IMAGE_URL.test(url)) continue;
    covers.set(id, url);
    savedOn.set(id, d);
  }
}

function saveStore() {
  saveTimer = null;
  const lines = [];
  // Oldest first (insertion order), keeping only the newest STORE_MAX.
  for (const id of [...savedOn.keys()].slice(-STORE_MAX)) {
    const m = IMAGE_URL.exec(covers.get(id) ?? '');
    if (m) lines.push(`${id} ${m[1]} ${m[2]} ${savedOn.get(id)}`);
  }
  try {
    globalThis.localStorage?.setItem(STORE_KEY, lines.join('\n'));
  } catch {
    // Full or blocked storage: covers are still cached for this page.
  }
}

function scheduleSave() {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(saveStore, 2000);
}

if (typeof window !== 'undefined') {
  // Read the store while the page is idle, so opening an edition does not pay
  // for it; any earlier cover request reads it on demand.
  (window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1)))(loadStore);
  window.addEventListener('pagehide', () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveStore();
    }
  });
}

// ---------------------------------------------------------------------------
// Change notification: one subscription per track id, flushed once per frame
// so a burst of answers re-renders the affected tiles together.

const changed = new Set();
let flushScheduled = false;

function flush() {
  flushScheduled = false;
  const ids = [...changed];
  changed.clear();
  for (const id of ids) {
    const set = listeners.get(id);
    if (set) for (const l of set) l();
  }
}

function notify(id) {
  changed.add(id);
  if (flushScheduled) return;
  flushScheduled = true;
  if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
}

// ---------------------------------------------------------------------------
// The lookup queue.

function next() {
  for (let tier = ON_SCREEN; tier <= NEAR; tier++) {
    const q = queues[tier];
    while (q.length) {
      const id = q.shift();
      if (queued.get(id) === tier) {
        queued.delete(id);
        return id;
      }
    }
  }
  return null;
}

// Rate limiting. `limited` is true from a 429 until a lookup succeeds again
// (or the pause ends with nothing left to ask for); the player bar reads it.
let pausedUntil = 0;
let pauseStep = 0;
let resumeTimer = null;
let limited = false;
const limitListeners = new Set();

function setLimited(value) {
  if (limited === value) return;
  limited = value;
  for (const l of limitListeners) l();
}

function resume() {
  resumeTimer = null;
  if (!queued.size) setLimited(false);
  pump();
}

function pause(is429, retryAfterMs) {
  if (is429) setLimited(true);
  const now = Date.now();
  // Answers to lookups sent before the pause began do not lengthen it.
  if (now < pausedUntil) return;
  const base = (is429 ? PAUSE_429_MS : PAUSE_DROPPED_MS) * 2 ** pauseStep;
  const ms = Math.min(PAUSE_MAX_MS, Math.max(base, retryAfterMs || 0));
  pauseStep++;
  pausedUntil = now + ms;
  maxInFlight = 1;
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(resume, ms);
}

/** The player embed failed to load: treat it as a 429 and pause lookups. */
export function reportSpotifyLimited() {
  pause(true);
}

/** Whether Spotify has answered 429 and has not yet answered normally since. */
export function useSpotifyLimited() {
  return useSyncExternalStore(
    (cb) => {
      limitListeners.add(cb);
      return () => limitListeners.delete(cb);
    },
    () => limited,
    () => false,
  );
}

// One lookup: the cover URL (or null), and whether Spotify refused it (429)
// or the connection failed.
async function lookup(id) {
  let r;
  try {
    r = await fetch(oembedUrl(id));
  } catch {
    return { url: null, dropped: true };
  }
  if (r.status === 429) {
    const seconds = Number(r.headers.get('retry-after'));
    return { url: null, refused: true, retryAfterMs: seconds > 0 ? seconds * 1000 : 0 };
  }
  if (!r.ok) return { url: null };
  try {
    const j = await r.json();
    return { url: typeof j?.thumbnail_url === 'string' ? j.thumbnail_url : null };
  } catch {
    return { url: null };
  }
}

function pump() {
  while (inFlight < maxInFlight && Date.now() >= pausedUntil) {
    const id = next();
    if (id === null) return;
    inFlight++;
    sent.add(id);
    lookup(id).then(({ url, refused, dropped, retryAfterMs }) => {
      inFlight--;
      sent.delete(id);
      if (refused) {
        pause(true, retryAfterMs);
        // Not a failed cover: ask again after the pause if a tile still wants it.
        if (listeners.has(id) && !queued.has(id)) {
          queued.set(id, ON_SCREEN);
          queues[ON_SCREEN].unshift(id);
        }
        return;
      }
      if (dropped) pause(false);
      covers.set(id, url);
      if (url) {
        failedAt.delete(id);
        if (IMAGE_URL.test(url)) {
          savedOn.delete(id);
          savedOn.set(id, today());
          scheduleSave();
        }
      } else {
        failedAt.set(id, Date.now());
      }
      if (!dropped) {
        // Spotify answered: lift the limit and work back up to full speed.
        pauseStep = 0;
        setLimited(false);
        if (maxInFlight < MAX_IN_FLIGHT) maxInFlight++;
      }
      // A failure changes nothing on screen (unknown and none both show
      // the fallback), so only a found cover wakes its tiles.
      if (url) notify(id);
      pump();
    });
  }
}

/**
 * Queue a cover lookup. `urgent` (a hovered tile, the playing track) puts it
 * at the front of the queue; `near` (a tile just outside the viewport) queues
 * it behind every on-screen tile. Lookups already in flight are not cancelled.
 */
export function requestCover(id, urgent = false, near = false) {
  if (!id) return;
  loadStore();
  if (covers.get(id) || sent.has(id)) return;
  if (covers.has(id) && Date.now() - failedAt.get(id) < RETRY_AFTER_MS) return;
  const tier = near && !urgent ? NEAR : ON_SCREEN;
  const at = queued.get(id);
  if (at !== undefined && at <= tier && !urgent) return;
  queued.set(id, tier);
  if (urgent) queues[tier].unshift(id);
  else queues[tier].push(id);
  pump();
}

/** Drop queued (not yet sent) lookups, e.g. for the tiles of a closed edition. */
export function cancelCovers(ids) {
  for (const id of ids) queued.delete(id);
}

/** The cover URL for a track: undefined while unknown, null when there is none. */
export function useCover(id) {
  const subscribe = useCallback((cb) => {
    if (!id) return () => {};
    let set = listeners.get(id);
    if (!set) listeners.set(id, (set = new Set()));
    set.add(cb);
    return () => {
      set.delete(cb);
      if (!set.size && listeners.get(id) === set) listeners.delete(id);
    };
  }, [id]);
  return useSyncExternalStore(subscribe, () => {
    if (!storeLoaded) loadStore();
    return covers.get(id);
  }, () => undefined);
}

const byPosition = (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
  || a.boundingClientRect.left - b.boundingClientRect.left;

/**
 * Request covers for the `[data-track-id]` elements inside `ref`: tiles in
 * the viewport first, top to bottom, then tiles within about 400 pixels of
 * it. Re-observes when `key` changes and drops the old tiles' queued lookups.
 */
export function useLazyCovers(ref, key) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const tiles = root.querySelectorAll('[data-track-id]');
    const ids = [...tiles].map(el => el.dataset.trackId);
    if (typeof IntersectionObserver === 'undefined') {
      ids.forEach(id => requestCover(id));
      return () => cancelCovers(ids);
    }
    const watch = (near, margin) => {
      const io = new IntersectionObserver(entries => {
        const hits = entries.filter(e => e.isIntersecting).sort(byPosition);
        for (const e of hits) {
          requestCover(e.target.dataset.trackId, false, near);
          io.unobserve(e.target);
        }
      }, { rootMargin: margin });
      tiles.forEach(el => io.observe(el));
      return io;
    };
    const onScreen = watch(false, '0px');
    const nearby = watch(true, '400px 0px');
    return () => {
      onScreen.disconnect();
      nearby.disconnect();
      cancelCovers(ids);
    };
  }, [ref, key]);
}

// ---------------------------------------------------------------------------
// Image size. Spotify album art comes in 64, 300 and 640 px variants of the
// same image id; oEmbed hands out the 300 px one. A tile is about 61 CSS px,
// so on a 1x screen the 64 px variant is enough until the tile is enlarged.

const ALBUM_300 = /\/image\/ab67616d00001e02([0-9a-f]{24})$/;

const SMALL_PX = 64;
let tilePx = 64; // last measured tile width in CSS px

/** The 64 px variant of a 300 px album-art URL, or null when there is none. */
export function smallCover(url) {
  if (!url || !IMAGE_URL.test(url) || !ALBUM_300.test(url)) return null;
  return url.replace(ALBUM_300, '/image/ab67616d00004851$1');
}

const smallFits = () => (globalThis.devicePixelRatio || 1) * tilePx <= SMALL_PX * 1.15;

/**
 * Whether the tiles in `ref` are small enough, at this screen's pixel ratio,
 * for the 64 px variant. Follows the first tile's size (re-found when `key`
 * changes) without forcing layout.
 */
export function useSmallCovers(ref, key) {
  const [fits, setFits] = useState(smallFits);
  useEffect(() => {
    const tile = ref.current?.querySelector('[data-track-id]');
    if (!tile || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      tilePx = e.contentRect.width || tilePx;
      setFits(smallFits());
    });
    ro.observe(tile);
    return () => ro.disconnect();
  }, [ref, key]);
  return fits;
}

/** Load and decode an image, so swapping it into a visible <img> does not flash. */
export function preloadImage(url) {
  const im = new Image();
  im.src = url;
  return im.decode();
}

// ---------------------------------------------------------------------------
// Connections. When the visitor is about to open an edition (a press, a
// pointer resting on a tile), open the connections the first lookups and
// images will need, so the first cover does not wait for two TLS handshakes.
// Browsers drop an unused preconnect after about ten seconds, so this repeats
// at most every eight.

const HOSTS = [
  ['https://open.spotify.com', 'anonymous'], // oEmbed, fetched with CORS
  ['https://image-cdn-ak.spotifycdn.com', null], // cover images (no-cors)
  ['https://image-cdn-fa.spotifycdn.com', null],
];
let warmedAt = -Infinity;

export function warmCovers() {
  if (typeof document === 'undefined') return;
  const now = Date.now();
  if (now - warmedAt < 8000) return;
  warmedAt = now;
  for (const [href, cors] of HOSTS) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    if (cors) link.crossOrigin = cors;
    document.head.appendChild(link);
    setTimeout(() => link.remove(), 10_000);
  }
}
