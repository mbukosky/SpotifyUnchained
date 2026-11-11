import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRegion } from '../hooks/useRegion';
import { useEditions, loadEdition, adoptLinkedEdition } from '../hooks/useEditions';
import { warmCovers } from '../lib/covers';
import { REGION_COLORS } from '../lib/regions';
import {
  adjacentEditions,
  headlineNumbers,
  layoutWall,
  nearestEdition,
  regionTiles,
  sortEditions,
  weekKey,
  weekTiles,
} from '../lib/wall';
import ScaleHeadline from './ScaleHeadline';
import WallControls from './WallControls';
import Wall from './Wall';
import EditionPanel from './EditionPanel';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The open edition lives in `?edition=`. Replacing the history entry, not
// pushing, means stepping through twenty weeks leaves Back one press away from
// wherever the visitor came from. Other parameters are left alone.
function setEditionParam(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('edition', id);
  else url.searchParams.delete('edition');
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

const linkedId = () => new URLSearchParams(window.location.search).get('edition') || null;

export default function Archive() {
  const { region, showRegion } = useRegion();
  const { editions, loading, error } = useEditions();
  const isAll = region === 'ALL';

  const all = useMemo(() => sortEditions(editions), [editions]);
  const byId = useMemo(() => new Map(all.map(e => [e.id, e])), [all]);
  const visible = useMemo(() => (isAll ? all : all.filter(e => e.region === region)), [all, isAll, region]);
  const tiles = useMemo(() => (isAll ? weekTiles(visible) : regionTiles(visible)), [visible, isAll]);
  const wall = useMemo(() => layoutWall(tiles), [tiles]);
  const numbers = useMemo(() => headlineNumbers(tiles), [tiles]);
  const tilesByKey = useMemo(() => new Map(tiles.map(t => [t.key, t])), [tiles]);

  // A deep link's edition is open from the first render, so the panel mounts
  // in the same commit as the wall (its data is already on the way from
  // index.html). Until the index confirms the id, nothing is shown for it.
  const [openId, setOpenId] = useState(() => {
    adoptLinkedEdition();
    return linkedId();
  });
  const [focus, setFocus] = useState({ token: 0, heading: false });
  const [lucky, setLucky] = useState(null);
  const [dipping, setDipping] = useState(false);
  const wallRef = useRef(null);
  const linkHandled = useRef(false);
  const linkRegion = useRef(null); // the region a deep link is switching to

  // Before the deep link is confirmed, its edition shows only on a wall that
  // holds it; otherwise it waits one render for the switch to its region.
  const candidate = (openId && byId.get(openId)) || null;
  const openEdition = candidate && (linkHandled.current || isAll || candidate.region === region) ? candidate : null;

  const open = useCallback((id, { reveal = true, focusHeading = true } = {}) => {
    // Start the request before React renders the panel; the panel picks up
    // the same promise from the page cache.
    if (id) {
      warmCovers();
      loadEdition(id).catch(() => {});
    }
    setOpenId(id);
    setEditionParam(id);
    if (reveal) setFocus(f => ({ token: f.token + 1, heading: focusHeading }));
  }, []);

  const close = useCallback(({ refocus = true } = {}) => {
    const key = openEdition ? weekKey(openEdition.date) : null;
    setOpenId(null);
    setLucky(null);
    setEditionParam(null);
    // The panel and the focus inside it are gone; return focus to its tile.
    if (refocus) requestAnimationFrame(() => wallRef.current?.focusTile(key));
  }, [openEdition]);

  // Deep link: once the index is in, confirm `?edition=` or drop it if unknown.
  useEffect(() => {
    if (loading || error || linkHandled.current) return;
    linkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get('edition');
    if (!id) return;
    const linked = byId.get(id);
    if (!linked) {
      setOpenId(null);
      setEditionParam(null);
      return;
    }
    // Show the linked edition's region for this visit only; the saved choice stays.
    if (region !== 'ALL' && linked.region !== region) {
      linkRegion.current = linked.region;
      showRegion(linked.region);
    }
    open(id);
  }, [loading, error, byId, region, showRegion, open]);

  // Picking a region the open edition is not in closes it. ALL holds every
  // region, so switching to ALL keeps the panel. A deep link's own switch to
  // its edition's region is not a pick.
  useEffect(() => {
    if (linkRegion.current) {
      if (linkRegion.current !== region) return;
      linkRegion.current = null;
    }
    if (openEdition && !isAll && openEdition.region !== region) close({ refocus: false });
  }, [openEdition, isAll, region, close]);

  const openTile = useCallback((tile) => {
    setLucky(null);
    open(tile.editions[0].id);
  }, [open]);

  // A press, or a pointer resting on a tile, signals the visitor is about to
  // open it: start fetching so the panel has its data sooner.
  const intendTile = useCallback((tile) => {
    loadEdition(tile.editions[0].id).catch(() => {});
    warmCovers();
  }, []);

  const jump = (date) => {
    const target = nearestEdition(visible, date);
    setLucky(null);
    // Keep focus in the date field so the visitor can keep adjusting it.
    if (target) open(target.id, { focusHeading: false });
  };

  const luckyDip = async () => {
    if (dipping) return;
    const pool = visible.filter(e => e.trackCount > 0);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setDipping(true);
    const request = loadEdition(pick.id).catch(() => null);
    try {
      if (!reducedMotion()) await wallRef.current?.dip(weekKey(pick.date));
    } finally {
      const data = await request;
      const tracks = data?.tracks || [];
      const track = tracks[Math.floor(Math.random() * tracks.length)];
      setLucky(track ? { editionId: pick.id, trackId: track.id } : null);
      open(pick.id);
      setDipping(false);
    }
  };

  const ready = !loading && !error && visible.length > 0;
  const { previous, next } = openEdition ? adjacentEditions(all, openEdition.id) : {};
  const selectedKey = openEdition ? weekKey(openEdition.date) : null;
  const week = isAll && openEdition ? tilesByKey.get(selectedKey) : null;
  const latestKey = tiles.length ? tiles[tiles.length - 1].key : null;
  const accent = isAll ? '#ffffff' : REGION_COLORS[region] || REGION_COLORS.US;

  return (
    <div className={`archive-inner${isAll ? ' is-all' : ''}`} style={{ '--rc': accent, '--sel-c': openEdition ? REGION_COLORS[openEdition.region] : accent }}>
      <section className="archive-head">
        <div className="archive-kicker-row">
          <p className="archive-kicker">Every Friday, preserved.</p>
          <a className="kofi-link" href="https://ko-fi.com/A1439LK" target="_blank" rel="noopener noreferrer">
            ☕ Buy me a coffee
          </a>
        </div>
        {ready && numbers && <ScaleHeadline numbers={numbers} region={region} />}
      </section>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading playlists...</p>
        </div>
      )}

      {!loading && error && (
        <div className="error-state">
          <p>Failed to load playlists. Please try again.</p>
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="empty-state">
          <div className="empty-wall" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => <i key={i} style={{ '--d': `${((i * 37) % 30) * 60}ms` }} />)}
          </div>
          <strong>No playlists found</strong>
          Try selecting a different region filter.
        </div>
      )}

      {ready && (
        <>
          <WallControls
            first={visible[0].date}
            last={visible[visible.length - 1].date}
            selected={openEdition?.date ?? ''}
            dipping={dipping}
            onLuckyDip={luckyDip}
            onJump={jump}
          />
          <Wall
            ref={wallRef}
            wall={wall}
            isAll={isAll}
            regionKey={region}
            selectedKey={selectedKey}
            latestKey={latestKey}
            dipping={dipping}
            onOpen={openTile}
            onIntent={intendTile}
          />
          <WallLegend isAll={isAll} />
          {openEdition && (
            <EditionPanel
              edition={openEdition}
              previous={previous}
              next={next}
              week={week}
              focusToken={focus.token}
              focusHeading={focus.heading}
              lucky={lucky}
              onOpen={(id) => { setLucky(null); open(id, { reveal: false }); }}
              onClose={() => close()}
            />
          )}
        </>
      )}
    </div>
  );
}

function WallLegend({ isAll }) {
  return (
    <div className="wall-legend">
      <span className="wall-legend-scale">
        {isAll ? 'Fewer regions' : 'Fewer tracks'}
        <i className="wall-swatch step-0" /><i className="wall-swatch step-1" />
        <i className="wall-swatch step-2" /><i className="wall-swatch step-3" />
        More
      </span>
      <span><i className="wall-swatch is-empty" /> Not archived</span>
      <span><i className="wall-swatch is-latest-dot" /> Latest</span>
      <span className="wall-legend-keys">Arrow keys move between tiles</span>
    </div>
  );
}
