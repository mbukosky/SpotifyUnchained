// Track cover art. The edition response carries each track's 300 px album
// image URL (stored by the sync), so the browser never asks Spotify which
// cover a track has: the only requests to Spotify for covers are the images
// themselves. This module checks those URLs, picks the image size a tile
// needs, and warms the image host's connection.
import { useEffect, useState } from 'react';

// Spotify's image hosts. A stored URL that does not match is treated as no
// cover rather than handed to an <img>; `img-src` allows the same hosts.
export const IMAGE_URL = /^https:\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/image\/([0-9a-f]{40})$/;

/** A track's stored cover URL if it is one of Spotify's images, else null. */
export const coverUrl = (url) => (typeof url === 'string' && IMAGE_URL.test(url) ? url : null);

// ---------------------------------------------------------------------------
// Image size. Spotify album art comes in 64, 300 and 640 px variants of the
// same image id, and the archive stores the 300 px one. A tile is about 61
// CSS px, so on a 1x screen the 64 px variant is enough until the tile is
// enlarged. The oldest editions' covers use an older id format with no
// derivable variant; those tiles use the 300 px image.

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
// pointer resting on a tile), open the connection the first images will need,
// so the first cover does not wait for a TLS handshake. Stored covers all come
// from i.scdn.co. Browsers drop an unused preconnect after about ten seconds,
// so this repeats at most every eight.

const IMAGE_HOST = 'https://i.scdn.co'; // images load without CORS
let warmedAt = -Infinity;

export function warmCovers() {
  if (typeof document === 'undefined') return;
  const now = Date.now();
  if (now - warmedAt < 8000) return;
  warmedAt = now;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = IMAGE_HOST;
  document.head.appendChild(link);
  setTimeout(() => link.remove(), 10_000);
}
