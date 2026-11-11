/**
 * The cover URL for a Spotify track object: its album's 300 px image, else the
 * widest image, else ''. Kept free of config and database imports so the
 * backfill script can use it, and re-exported from sync.js.
 */
export function chooseCover(track) {
  const images = (track?.album?.images || []).filter(img => img?.url);
  if (images.length === 0) return '';
  const exact = images.find(img => img.width === 300);
  if (exact) return exact.url;
  return images.reduce((widest, img) => ((img.width || 0) > (widest.width || 0) ? img : widest)).url;
}
