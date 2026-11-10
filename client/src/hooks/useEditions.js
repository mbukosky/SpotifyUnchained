import { useState, useEffect } from 'react';
import { mark } from '../lib/perf';

// index.html starts the index request (and, on a deep link, the linked
// edition's request) before the app bundle has loaded, and leaves them in
// `window.__suEarly` as promises of parsed JSON. Each is used at most once;
// later requests go through fetch as usual.
//
// The first render always shows the loading state, even when the index is
// already parsed: painting the header and spinner first, then the wall, put
// the first paint ~200 ms earlier unthrottled in our measurements, with the
// wall drawn no later.
const early = () => (typeof window !== 'undefined' ? window.__suEarly : null);

function takeEarly(key, matches = () => true) {
  const all = early();
  const entry = all?.[key];
  if (!entry || !matches(entry)) return null;
  all[key] = null;
  return entry.request;
}

const fetchJson = (url, what) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Failed to fetch ${what}: ${res.status}`);
  return res.json();
});

// One index request per page load, shared by every mount (React's dev-mode
// double effect included). A failure is dropped so a later mount can retry.
let indexRequest = null;

export function loadIndex() {
  if (!indexRequest) {
    const fromPage = takeEarly('index');
    indexRequest = (fromPage || fetchJson('/spotify/editions', 'editions'))
      .then(data => {
        const items = data.items || [];
        // index.html marks the response it parsed itself.
        if (!fromPage) mark('index-loaded', items.length);
        return items;
      })
      .catch(err => {
        indexRequest = null;
        throw err;
      });
  }
  return indexRequest;
}

/**
 * Fetches the edition index once. The index holds every region, so changing
 * region filters it in memory and costs no request.
 */
export function useEditions() {
  const [state, setState] = useState({ editions: [], loading: true, error: null });

  useEffect(() => {
    let live = true;
    loadIndex()
      .then(items => live && setState({ editions: items, loading: false, error: null }))
      .catch(err => live && setState({ editions: [], loading: false, error: err.message }));
    return () => { live = false; };
  }, []);

  return state;
}

/**
 * The API sends an edition's tracks as columns (`{ id: [], name: [], artist: [] }`)
 * and leaves out `uri` and `open_url` when they follow from the track id.
 * Rebuild the track objects every consumer expects.
 */
export function expandTracks(columns) {
  if (Array.isArray(columns)) return columns;
  const ids = columns?.id || [];
  return ids.map((id, i) => ({
    id,
    name: columns.name?.[i] ?? '',
    artist: columns.artist?.[i] ?? '',
    uri: columns.uri ? columns.uri[i] : `spotify:track:${id}`,
    open_url: columns.open_url ? columns.open_url[i] : `https://open.spotify.com/track/${id}`,
  }));
}

// Opened editions never change after their week, so keep them for the life of
// the page: reopening a tile or stepping back costs no request. Failures are
// not kept, so a retry fetches again.
const cache = new Map();

/** Fetch one edition with its tracks, from the page-lifetime cache when possible. */
export function loadEdition(id) {
  if (cache.has(id)) return cache.get(id);
  const response = takeEarly('edition', e => e.id === id) || fetchJson(`/spotify/editions/${encodeURIComponent(id)}`, 'edition');
  const request = response
    .then(data => ({ ...data, tracks: expandTracks(data.tracks) }))
    .catch(err => {
      cache.delete(id);
      throw err;
    });
  cache.set(id, request);
  return request;
}

/** True once `id` is in the page cache or on its way. */
export const isEditionLoading = id => cache.has(id);

/**
 * Fetch editions the visitor is likely to open next (the neighbours of the
 * open one) when the browser is idle. Errors are ignored: a real open retries.
 */
export function prefetchEditions(ids) {
  const wanted = ids.filter(id => id && !cache.has(id));
  if (wanted.length === 0) return () => {};
  const run = () => wanted.forEach(id => loadEdition(id).catch(() => {}));
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 200);
  return () => clearTimeout(handle);
}
