import { useEffect, useRef, useState } from 'react';
import CoverGrid from './CoverGrid';
import PlayerBar from './PlayerBar';
import PlaylistDownload from './PlaylistDownload';
import { loadEdition } from '../hooks/useEditions';
import { REGION_COLORS } from '../lib/regions';
import { formatLongDate } from '../lib/wall';
import { mark, markPainted } from '../lib/perf';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The open edition, inline under the wall. It stays mounted while the visitor
 * steps between editions so focus stays on the button they pressed.
 *
 * `focusToken` changes when the edition was opened from outside the panel
 * (a tile, a deep link, a jump or a lucky dip); the panel then brings its
 * heading into view. `lucky` ({ editionId, trackId }, a new object per dip)
 * asks for that track to open in the player bar and its tile to scroll into
 * view.
 */
export default function EditionPanel({
  edition, previous, next, week, focusToken, focusHeading, lucky,
  onOpen, onClose,
}) {
  const [load, setLoad] = useState({ id: null, data: null, error: false });
  // The open track: { id, index }. A lucky dip knows only the id (index -1)
  // until the tracks are in.
  const [activeTrack, setActiveTrack] = useState(null);
  const headingRef = useRef(null);
  const listRef = useRef(null);
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  // Each edition starts with the player closed, unless a lucky dip chose a
  // track in it. Reset during render so the old embed never flashes.
  const luckyTrackId = lucky?.editionId === edition.id ? lucky.trackId : null;
  const [seen, setSeen] = useState({ id: null, lucky: null });
  if (seen.id !== edition.id || seen.lucky !== lucky) {
    setSeen({ id: edition.id, lucky });
    setActiveTrack(luckyTrackId ? { id: luckyTrackId, index: -1 } : null);
  }

  useEffect(() => {
    let live = true;
    markPainted('panel-open', edition.id);
    loadEdition(edition.id)
      .then(data => {
        mark('edition-loaded', edition.id);
        return live && setLoad({ id: edition.id, data, error: false });
      })
      .catch(() => live && setLoad({ id: edition.id, data: null, error: true }));
    return () => { live = false; };
  }, [edition.id]);

  const ready = load.id === edition.id;
  const data = ready ? load.data : null;
  const failed = ready && load.error;

  // Bring the heading into view and give it focus when opened from outside.
  useEffect(() => {
    if (!focusToken) return;
    const h = headingRef.current;
    if (!h) return;
    if (focusHeading) h.focus({ preventScroll: true });
    if (!luckyTrackId) h.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }, [focusToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lucky dip: once the tracks are in, scroll the chosen tile into view.
  useEffect(() => {
    if (!data || !luckyTrackId) return;
    const tile = listRef.current?.querySelector(`[data-track-id="${CSS.escape(luckyTrackId)}"]`);
    tile?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }, [data, lucky]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stepping onto the first or last edition disables the button that was
  // pressed; hand focus to its partner rather than dropping it on <body>.
  useEffect(() => {
    const active = document.activeElement;
    if (active === document.body || active === null) {
      if (prevRef.current?.dataset.pressed && !previous) nextRef.current?.focus();
      if (nextRef.current?.dataset.pressed && !next) prevRef.current?.focus();
    }
    if (prevRef.current) delete prevRef.current.dataset.pressed;
    if (nextRef.current) delete nextRef.current.dataset.pressed;
  }, [edition.id, previous, next]);

  const step = (target, btn) => {
    if (!target) return;
    if (btn.current) btn.current.dataset.pressed = '1';
    onOpen(target.id);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const color = REGION_COLORS[edition.region] || REGION_COLORS.US;

  const tracks = data?.tracks || [];
  const activeIndex = !activeTrack ? -1
    : activeTrack.index >= 0 ? activeTrack.index
    : tracks.findIndex(t => t.id === activeTrack.id);
  // Activating the open track again leaves it playing.
  const play = (i) => {
    if (tracks[i]) setActiveTrack({ id: tracks[i].id, index: i });
  };
  const tuesday = /tuesday/i.test(edition.title);

  return (
    <section
      className="edition-panel"
      style={{ '--rc': color }}
      aria-labelledby="edition-title"
      onKeyDown={onKeyDown}
    >
      <div className="ep-bar">
        <div className="ep-steps">
          <button
            ref={prevRef}
            type="button"
            className="ep-btn ep-step"
            onClick={() => step(previous, prevRef)}
            disabled={!previous}
            aria-label="Previous edition"
            title={previous ? formatLongDate(previous.date) : undefined}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12.5 5 L7.5 10 L12.5 15" />
            </svg>
            <span className="ep-step-label">Previous</span>
          </button>
          <button
            ref={nextRef}
            type="button"
            className="ep-btn ep-step"
            onClick={() => step(next, nextRef)}
            disabled={!next}
            aria-label="Next edition"
            title={next ? formatLongDate(next.date) : undefined}
          >
            <span className="ep-step-label">Next</span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7.5 5 L12.5 10 L7.5 15" />
            </svg>
          </button>
        </div>
        <div className="ep-tools">
          {data ? <PlaylistDownload playlist={data} /> : <span className="ep-dl-placeholder" aria-hidden="true" />}
          <button type="button" className="ep-btn ep-close" onClick={onClose} aria-label="Close edition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <header className="ep-head">
        <p className="ep-kicker">
          <span className="ep-region">{edition.region}</span>
          <span className="ep-dot" aria-hidden="true">·</span>
          {tuesday ? 'New Music Tuesday' : 'New Music Friday'}
        </p>
        <h2 id="edition-title" className="ep-title" ref={headingRef} tabIndex={-1}>
          {formatLongDate(edition.date)}
        </h2>
        <p className="ep-meta">{edition.trackCount} tracks</p>
      </header>

      {week && week.editions.length > 0 && (
        <div className="ep-regions" role="group" aria-label="Regions archived this week">
          {week.editions.map(e => (
            <button
              key={e.id}
              type="button"
              className={`ep-region-btn${e.region === edition.region ? ' active' : ''}`}
              style={{ '--region-c': REGION_COLORS[e.region] }}
              aria-pressed={e.region === edition.region}
              onClick={() => e.id !== edition.id && onOpen(e.id)}
            >
              {e.region}
            </button>
          ))}
        </div>
      )}

      <div className="ep-body" ref={listRef}>
        {!ready && (
          <div className="ep-state" role="status">
            <div className="loading-spinner" />
            <p>Loading edition...</p>
          </div>
        )}
        {failed && (
          <div className="ep-state ep-error" role="alert">
            <p>Failed to load this edition. Please try again.</p>
          </div>
        )}
        {data && (
          <div className="ep-tracks" key={data.id}>
            <CoverGrid tracks={data.tracks} accent={color} activeIndex={activeIndex} onPlay={play} />
            <PlayerBar edition={data} index={activeIndex} accent={color} onSelect={play} onClose={() => setActiveTrack(null)} />
          </div>
        )}
      </div>
    </section>
  );
}
