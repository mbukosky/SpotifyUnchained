import { useCallback, useEffect, useRef, useState } from 'react';
import SavePlaylist from './SavePlaylist';
import Equalizer from './Equalizer';
import { coverUrl } from '../lib/covers';
import { artistColor, clean, position } from '../lib/tracks';

const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

const SPOTIFY = 'https://open.spotify.com';
const EMBED_READY_MS = 6000;
const HOLD_MS = 30_000;

// When an embed last missed its ready deadline, or -Infinity once one has
// reported ready since. Module-level so it outlives the Frame of the refused
// track: the next track opened reads it.
let refusedAt = -Infinity;
const holdLeft = () => refusedAt + HOLD_MS - Date.now();

// The compact Spotify player. It asks the embed to start once it loads;
// browsers may still block autoplay until the visitor presses play. A working
// embed posts messages to this page (first "ready"); the page cannot see
// inside the frame, so when none arrives within a few seconds of the frame
// loading, the frame is showing an error page (usually Spotify's 429) and
// `onAlive(false)` is called. A message arriving later calls `onAlive(true)`.
function Embed({ track, onAlive }) {
  const ref = useRef(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return undefined;
    let toggle;
    let watchdog;
    let alive = false;
    const onLoad = () => {
      toggle = setTimeout(() => frame.contentWindow?.postMessage({ command: 'toggle' }, SPOTIFY), 500);
      clearTimeout(watchdog);
      if (!alive) watchdog = setTimeout(() => onAlive(false), EMBED_READY_MS);
    };
    const onMessage = (e) => {
      if (e.origin !== SPOTIFY || e.source !== frame.contentWindow) return;
      clearTimeout(watchdog);
      if (!alive) onAlive(true);
      alive = true;
    };
    frame.addEventListener('load', onLoad);
    window.addEventListener('message', onMessage);
    return () => {
      frame.removeEventListener('load', onLoad);
      window.removeEventListener('message', onMessage);
      clearTimeout(toggle);
      clearTimeout(watchdog);
    };
  }, [onAlive]);
  return (
    <iframe
      ref={ref}
      className="player-embed"
      src={`${SPOTIFY}/embed/track/${track.id}?utm_source=generator&theme=0`}
      width="100%"
      height="80"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      title={`Spotify player: ${clean(track.name)}`}
    />
  );
}

// The embed, with a notice in its place when Spotify is refusing it. Spotify
// limits embeds per visitor, so:
// - an embed that loads but never reports ready is covered by the notice;
// - a track opened within 30 seconds of that does not load its embed until
//   the 30 seconds are up, so a burst of track changes does not keep the
//   limit hit. Each refusal starts the 30 seconds again; there is no backoff,
//   as one embed every 30 seconds is already gentle.
// "Try now" loads the embed at once. An embed that works is never taken away.
function Frame({ track }) {
  const [held, setHeld] = useState(() => holdLeft() > 0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!held) return undefined;
    const timer = setTimeout(() => setHeld(false), Math.max(0, holdLeft()));
    return () => clearTimeout(timer);
  }, [held]);
  const onAlive = useCallback((ok) => {
    setFailed(!ok);
    refusedAt = ok ? -Infinity : Date.now();
  }, []);
  const retry = () => {
    // The visitor chose to try: the next track opened should try too.
    refusedAt = -Infinity;
    setHeld(false);
    setFailed(false);
    setAttempt(n => n + 1);
  };
  return (
    <>
      {!held && <Embed key={attempt} track={track} onAlive={onAlive} />}
      {(held || failed) && (
        <div className="player-limited" role="status">
          <span>
            {held
              ? 'Spotify is limiting requests right now. The player will be back shortly.'
              : 'The Spotify player did not load. Spotify may be limiting requests right now.'}
          </span>
          <button type="button" className="player-retry" onClick={retry}>Try now</button>
        </div>
      )}
    </>
  );
}

/**
 * The bar below the cover grid's last row. It holds the single embed and the
 * save button, and scrolls with the grid.
 */
export default function PlayerBar({ edition, index, accent, onSelect, onClose }) {
  const tracks = edition.tracks;
  const track = index >= 0 ? tracks[index] : null;
  const cover = coverUrl(track?.cover);

  const color = track ? artistColor(track.artist, accent) : null;
  const name = track ? clean(track.name) : '';

  return (
    <div className={`player-bar${track ? ' is-open' : ''}`} role="region" aria-label="Player">
      {track ? (
        <>
          <div className="player-now" style={{ '--tile-c': color.color }}>
            <span className="player-art" style={{ background: color.gradient }} aria-hidden="true">
              {cover && <img key={cover} src={cover} alt="" onError={(e) => { e.currentTarget.hidden = true; }} />}
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
          <div className="player-frame"><Frame key={`${track.id}-${index}`} track={track} /></div>
        </>
      ) : (
        <p className="player-hint">{finePointer() ? 'Hover a cover to see its track, click to play it here.' : 'Tap a cover to play it here.'}</p>
      )}
      <div className="player-save"><SavePlaylist playlist={edition} /></div>
    </div>
  );
}
