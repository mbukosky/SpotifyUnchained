import { useEffect, useRef } from 'react';
import SavePlaylist from './SavePlaylist';
import Equalizer from './Equalizer';
import { requestCover, useCover } from '../lib/covers';
import { artistColor, clean, position } from '../lib/tracks';

const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

// The compact Spotify player. It asks the embed to start once it loads;
// browsers may still block autoplay until the visitor presses play.
function Embed({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return undefined;
    let timer;
    const onLoad = () => {
      timer = setTimeout(() => frame.contentWindow?.postMessage({ command: 'toggle' }, 'https://open.spotify.com'), 500);
    };
    frame.addEventListener('load', onLoad);
    return () => {
      frame.removeEventListener('load', onLoad);
      clearTimeout(timer);
    };
  }, []);
  return (
    <iframe
      ref={ref}
      className="player-embed"
      src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`}
      width="100%"
      height="80"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      title={`Spotify player: ${clean(track.name)}`}
    />
  );
}

/**
 * The bar under the cover grid. It sticks to the bottom of the viewport while
 * the grid is taller than the screen, and sits after the grid in flow, so it
 * never covers the last row once the visitor reaches the end. It holds the
 * single embed and the save button.
 */
export default function PlayerBar({ edition, index, accent, onSelect, onClose }) {
  const ref = useRef(null);
  const tracks = edition.tracks;
  const track = index >= 0 ? tracks[index] : null;
  const cover = useCover(track?.id);

  useEffect(() => {
    if (track) requestCover(track.id, true);
  }, [track]);

  // Publish the bar's height so tiles scrolled into view clear it.
  useEffect(() => {
    const bar = ref.current;
    const host = bar?.parentElement;
    if (!bar || !host || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => host.style.setProperty('--player-h', `${bar.offsetHeight}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const color = track ? artistColor(track.artist, accent) : null;
  const name = track ? clean(track.name) : '';

  return (
    <div ref={ref} className={`player-bar${track ? ' is-open' : ''}`} role="region" aria-label="Player">
      {track ? (
        <>
          <div className="player-now" style={{ '--tile-c': color.color }}>
            <span className="player-art" style={{ background: color.gradient }} aria-hidden="true">
              {cover && <img src={cover} alt="" />}
              <Equalizer />
            </span>
            <span className="player-text" aria-live="polite">
              <span className="player-label">Now playing · {position(index)}/{tracks.length}</span>
              <strong className="player-name">{name}</strong>
              <span className="player-artist">{clean(track.artist)}</span>
            </span>
          </div>
          <div className="player-ctrls">
            <button type="button" className="player-btn" onClick={() => onSelect(index - 1)} disabled={index <= 0} aria-label="Previous track">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 4h2v12H5zM16 4v12L8 10z" /></svg>
            </button>
            <button type="button" className="player-btn" onClick={() => onSelect(index + 1)} disabled={index >= tracks.length - 1} aria-label="Next track">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M13 4h2v12h-2zM4 4v12l8-6z" /></svg>
            </button>
            <a className="player-btn" href={track.open_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${name} on Spotify`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <button type="button" className="player-btn" onClick={onClose} aria-label="Close player">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="player-frame"><Embed key={`${track.id}-${index}`} track={track} /></div>
        </>
      ) : (
        <p className="player-hint">{finePointer() ? 'Hover a cover to see its track, click to play it here.' : 'Tap a cover to play it here.'}</p>
      )}
      <div className="player-save"><SavePlaylist playlist={edition} /></div>
    </div>
  );
}
