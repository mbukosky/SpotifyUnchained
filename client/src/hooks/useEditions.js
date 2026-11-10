import { useState, useEffect } from 'react';

// One index request per page load, shared by every mount (React's dev-mode
// double effect included). A failure is dropped so a later mount can retry.
let indexRequest = null;

function loadIndex() {
  if (!indexRequest) {
    indexRequest = fetch('/spotify/editions')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch editions: ${res.status}`);
        return res.json();
      })
      .then(data => data.items || [])
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

// Opened editions never change after their week, so keep them for the life of
// the page: reopening a tile or stepping back costs no request. Failures are
// not kept, so a retry fetches again.
const cache = new Map();

/** Fetch one edition with its tracks, from the page-lifetime cache when possible. */
export function loadEdition(id) {
  if (cache.has(id)) return cache.get(id);
  const request = fetch(`/spotify/editions/${encodeURIComponent(id)}`)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch edition: ${res.status}`);
      return res.json();
    })
    .catch(err => {
      cache.delete(id);
      throw err;
    });
  cache.set(id, request);
  return request;
}
