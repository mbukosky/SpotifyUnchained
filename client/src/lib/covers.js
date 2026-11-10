// Track cover art, looked up in the browser from Spotify's public oEmbed
// endpoint. Lookups are lazy (tiles near the viewport only), at most six in
// flight, and cached for the life of the page. A failed lookup is cached as
// null so the tile keeps its fallback; it may be asked for again after a
// minute (on hover, or when its edition is reopened), since Spotify
// sometimes throttles a burst of lookups for a short while.
import { useEffect, useSyncExternalStore } from 'react';

const MAX_IN_FLIGHT = 6;
const RETRY_AFTER_MS = 60_000;

const covers = new Map(); // track id → thumbnail URL, or null when the lookup failed
const failedAt = new Map(); // track id → time of the last failed lookup
const queued = new Set();
const queue = [];
const listeners = new Set();
let inFlight = 0;

const oembedUrl = (id) =>
  `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`;

function emit() {
  for (const l of listeners) l();
}

function pump() {
  while (inFlight < MAX_IN_FLIGHT && queue.length) {
    const id = queue.shift();
    inFlight++;
    fetch(oembedUrl(id))
      .then(r => (r.ok ? r.json() : null))
      .then(j => (typeof j?.thumbnail_url === 'string' ? j.thumbnail_url : null))
      .catch(() => null)
      .then(url => {
        covers.set(id, url);
        if (url) failedAt.delete(id);
        else failedAt.set(id, Date.now());
        queued.delete(id);
        inFlight--;
        emit();
        pump();
      });
  }
}

/**
 * Queue a cover lookup. `urgent` (a hovered tile) moves it to the front of
 * the queue; lookups already in flight are not cancelled.
 */
export function requestCover(id, urgent = false) {
  if (!id || covers.get(id)) return;
  if (covers.has(id) && Date.now() - failedAt.get(id) < RETRY_AFTER_MS) return;
  if (queued.has(id)) {
    if (urgent) {
      const at = queue.indexOf(id);
      if (at > 0) {
        queue.splice(at, 1);
        queue.unshift(id);
      }
    }
    return;
  }
  queued.add(id);
  if (urgent) queue.unshift(id);
  else queue.push(id);
  pump();
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The cover URL for a track: undefined while unknown, null when there is none. */
export function useCover(id) {
  return useSyncExternalStore(subscribe, () => covers.get(id), () => undefined);
}

/**
 * Request covers for the `[data-track-id]` elements inside `ref` as they come
 * within about 400 pixels of the viewport. Re-observes when `key` changes.
 */
export function useLazyCovers(ref, key) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const tiles = root.querySelectorAll('[data-track-id]');
    if (typeof IntersectionObserver === 'undefined') {
      tiles.forEach(el => requestCover(el.dataset.trackId));
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        requestCover(e.target.dataset.trackId);
        io.unobserve(e.target);
      }
    }, { rootMargin: '400px 0px' });
    tiles.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [ref, key]);
}
