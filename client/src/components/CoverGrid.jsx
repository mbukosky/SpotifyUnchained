import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { requestCover, useCover, useLazyCovers } from '../lib/covers';
import { mark, markPainted } from '../lib/perf';
import { artistColor, clean, initials, moveIndex, position, tileLabel } from '../lib/tracks';
import Equalizer from './Equalizer';

const TIP_GAP = 8;

// Hover enlarges a tile only for fine pointers; the label clears the grown tile.
const grows = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
const TILE_SCALE = 1.7;

const CoverTile = memo(function CoverTile({ track, index, gradient, color, playing, tabStop }) {
  const url = useCover(track.id);
  const [loaded, setLoaded] = useState(false);
  const shown = Boolean(url && loaded);
  return (
    <button
      type="button"
      className={`cover-tile${playing ? ' is-playing' : ''}${shown ? ' has-cover' : ''}`}
      style={{ '--tile-g': gradient, '--tile-c': color, '--i': index }}
      data-index={index}
      data-track-id={track.id}
      data-cover={shown ? 'loaded' : 'fallback'}
      tabIndex={tabStop ? 0 : -1}
      aria-label={tileLabel(track)}
      aria-current={playing || undefined}
    >
      <span className="cover-fallback" aria-hidden="true">{initials(track.artist)}</span>
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onLoad={() => {
            setLoaded(true);
            mark('cover-loaded', track.id);
          }}
          onError={() => setLoaded(false)}
        />
      )}
      {playing && <span className="cover-playing" aria-hidden="true"><Equalizer /></span>}
    </button>
  );
});

/**
 * Every track of an edition as a cover tile, in playlist order. One Tab stop;
 * arrows, Home and End move focus. A label with position, name and artist
 * follows mouse hover and keyboard focus.
 */
export default function CoverGrid({ tracks, accent, activeIndex, onPlay }) {
  const gridRef = useRef(null);
  const tipRef = useRef(null);
  const [tip, setTip] = useState(null); // index of the tile the label names
  const [focusIdx, setFocusIdx] = useState(activeIndex >= 0 ? activeIndex : 0);
  const [seenActive, setSeenActive] = useState(activeIndex);
  if (seenActive !== activeIndex) {
    setSeenActive(activeIndex);
    if (activeIndex >= 0) setFocusIdx(activeIndex);
  }

  const colors = useMemo(() => tracks.map(t => artistColor(t.artist, accent)), [tracks, accent]);
  useLazyCovers(gridRef, tracks);
  useEffect(() => markPainted('tracks-rendered', tracks.length), [tracks]);

  const tileAt = (target) => {
    const el = target?.closest?.('.cover-tile');
    return el && gridRef.current?.contains(el) ? el : null;
  };

  // Place the label above its tile (below when the sticky header is in the
  // way), clamped inside the grid so it is never clipped at the panel's edges.
  useLayoutEffect(() => {
    const label = tipRef.current;
    const grid = gridRef.current;
    const el = tip !== null && grid?.querySelector(`[data-index="${tip}"]`);
    if (!label || !el) return;
    const lw = label.offsetWidth;
    const lh = label.offsetHeight;
    const gap = TIP_GAP + (grows() ? (el.offsetHeight * (TILE_SCALE - 1)) / 2 : 0);
    const rect = el.getBoundingClientRect();
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    const bar = grid.parentElement?.querySelector('.player-bar')?.getBoundingClientRect().top ?? window.innerHeight;
    const fitsAbove = rect.top - gap - lh >= header + 4;
    const fitsBelow = rect.bottom + gap + lh <= Math.min(bar, window.innerHeight) - 4;
    const below = !fitsAbove && fitsBelow;
    const left = Math.max(0, Math.min(grid.clientWidth - lw, el.offsetLeft + el.offsetWidth / 2 - lw / 2));
    const top = below ? el.offsetTop + el.offsetHeight + gap : el.offsetTop - gap - lh;
    label.style.left = `${left}px`;
    label.style.top = `${top}px`;
    label.dataset.side = below ? 'below' : 'above';
  }, [tip]);

  const onPointerOver = (e) => {
    const el = tileAt(e.target);
    if (!el) return;
    requestCover(el.dataset.trackId, true);
    if (e.pointerType === 'mouse') setTip(Number(el.dataset.index));
  };

  // Leaving with the mouse hides the label, unless a tile has keyboard focus.
  const onPointerLeave = () => {
    const el = tileAt(document.activeElement);
    setTip(el?.matches(':focus-visible') ? Number(el.dataset.index) : null);
  };

  const onFocus = (e) => {
    const el = tileAt(e.target);
    if (!el) return;
    const i = Number(el.dataset.index);
    setFocusIdx(i);
    if (el.matches(':focus-visible')) {
      setTip(i);
      // Keep the focused tile clear of the sticky header and player bar.
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  const onBlur = (e) => {
    if (!gridRef.current?.contains(e.relatedTarget)) setTip(null);
  };

  const onClick = (e) => {
    const el = tileAt(e.target);
    if (!el) return;
    const i = Number(el.dataset.index);
    setFocusIdx(i);
    onPlay(i);
  };

  const onKeyDown = (e) => {
    const el = tileAt(e.target);
    if (!el || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const columns = getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length || 1;
    const next = moveIndex(Number(el.dataset.index), e.key, columns, tracks.length);
    if (next === null) return;
    e.preventDefault();
    gridRef.current.querySelector(`[data-index="${next}"]`)?.focus();
  };

  const t = tip !== null ? tracks[tip] : null;

  return (
    <div
      className="cover-grid"
      ref={gridRef}
      role="group"
      aria-label="Tracks"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerOver={onPointerOver}
      onPointerLeave={onPointerLeave}
    >
      {tracks.map((track, i) => (
        <CoverTile
          key={`${track.id}-${i}`}
          track={track}
          index={i}
          gradient={colors[i].gradient}
          color={colors[i].color}
          playing={i === activeIndex}
          tabStop={i === focusIdx}
        />
      ))}
      {t && (
        <div key={tip} ref={tipRef} className="cover-tip" style={{ '--tile-c': colors[tip].color }} aria-hidden="true">
          <span className="cover-tip-num">{position(tip)}{tip === activeIndex ? ' · Playing' : ''}</span>
          <strong className="cover-tip-name">{clean(t.name)}</strong>
          <span className="cover-tip-artist">{clean(t.artist)}</span>
        </div>
      )}
    </div>
  );
}
