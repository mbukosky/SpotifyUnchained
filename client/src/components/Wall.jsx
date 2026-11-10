import { memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatLongDate, monthColumns, tileLabel } from '../lib/wall';
import { markPainted } from '../lib/perf';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RIPPLE_RADIUS = 3;
const HOP_DELAYS = [70, 80, 95, 115, 140, 175, 220, 280];
// How long the pointer rests on a tile before its edition is fetched.
const INTENT_DWELL_MS = 150;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const media = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : { matches: false });
const reducedMotion = () => media('(prefers-reduced-motion: reduce)').matches;
// The ripple and the hover card are pointer effects; touch screens skip them.
const pointerEffects = () => media('(pointer: fine)').matches && !reducedMotion();

/**
 * The year-by-week grid. Tiles are plain buttons with no listeners of their
 * own: one delegated handler on the grid drives the ripple, hover card, focus
 * tracking and arrow keys, so ~640 tiles cost ~640 DOM nodes and no more.
 */
function Wall({ wall, isAll, regionKey, selectedKey, latestKey, dipping, onOpen, onIntent, ref }) {
  const { rows, columns } = wall;
  const scrollRef = useRef(null);
  const gridRef = useRef(null);
  const tileEls = useRef(new Map()); // tile key → button
  const cellEls = useRef(new Map()); // `${row}:${col}` → button
  const lifted = useRef([]);
  const [focusKey, setFocusKey] = useState(null);
  const [tip, setTip] = useState(null);
  const [spot, setSpot] = useState(null);

  const tilesByKey = useMemo(() => {
    const map = new Map();
    for (const row of rows) for (const t of row.slots) if (t) map.set(t.key, t);
    return map;
  }, [rows]);

  // Roving tabindex: the one tile in the Tab order is the last one focused,
  // else the selected one, else the latest. Opening a tile makes it the stop.
  const [prevSelected, setPrevSelected] = useState(selectedKey);
  if (prevSelected !== selectedKey) {
    setPrevSelected(selectedKey);
    if (selectedKey) setFocusKey(selectedKey);
  }
  const tabStop = [focusKey, selectedKey, latestKey].find(k => k && tilesByKey.has(k)) || null;

  // Index the rendered tiles so the delegated handlers can find neighbours.
  useLayoutEffect(() => {
    tileEls.current.clear();
    cellEls.current.clear();
    for (const el of gridRef.current?.querySelectorAll('.wall-tile') || []) {
      tileEls.current.set(el.dataset.key, el);
      cellEls.current.set(`${el.dataset.r}:${el.dataset.c}`, el);
    }
  }, [rows, regionKey]);

  // Narrow screens scroll the wall sideways: keep the selected tile, or the
  // latest one, in view.
  const scrollTarget = selectedKey && tilesByKey.has(selectedKey) ? selectedKey : latestKey;
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const el = tileEls.current.get(scrollTarget);
    if (!sc || !el || sc.scrollWidth <= sc.clientWidth) return;
    revealInScroller(sc, el, 'auto');
  }, [scrollTarget, rows, regionKey]);

  const clearRipple = () => {
    for (const el of lifted.current) el.style.removeProperty('--lift');
    lifted.current = [];
  };

  const ripple = (el) => {
    clearRipple();
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    for (let dy = -RIPPLE_RADIUS; dy <= RIPPLE_RADIUS; dy++) {
      for (let dx = -RIPPLE_RADIUS; dx <= RIPPLE_RADIUS; dx++) {
        const d = Math.hypot(dx, dy);
        if (d === 0 || d > RIPPLE_RADIUS) continue;
        const n = cellEls.current.get(`${r + dy}:${c + dx}`);
        if (!n) continue;
        n.style.setProperty('--lift', ((1 - d / (RIPPLE_RADIUS + 0.5)) * 0.42).toFixed(3));
        lifted.current.push(n);
      }
    }
  };

  const showTip = (el) => {
    const tile = tilesByKey.get(el.dataset.key);
    const frame = gridRef.current?.closest('.wall-frame');
    if (!tile || !frame) return;
    const box = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, 110), box.width - 110);
    setTip({ tile, x, y: r.top - box.top, below: r.top - box.top < 90 });
  };

  const hideTip = () => setTip(null);

  const intentTimer = useRef(null);
  const cancelIntent = () => clearTimeout(intentTimer.current);
  const intend = (el) => {
    const tile = tilesByKey.get(el.dataset.key);
    if (tile) onIntent?.(tile);
  };
  useEffect(() => cancelIntent, []);

  const onPointerOver = (e) => {
    const el = e.target.closest?.('.wall-tile');
    cancelIntent();
    if (el && e.pointerType === 'mouse') intentTimer.current = setTimeout(() => intend(el), INTENT_DWELL_MS);
    if (dipping || !pointerEffects()) return;
    if (!el) return;
    ripple(el);
    showTip(el);
  };

  const onPointerDown = (e) => {
    const el = e.target.closest?.('.wall-tile');
    if (el && e.button === 0) intend(el);
  };

  const onPointerLeave = () => {
    cancelIntent();
    clearRipple();
    hideTip();
  };

  const onFocus = (e) => {
    const el = e.target;
    if (!el.classList?.contains('wall-tile')) return;
    setFocusKey(el.dataset.key);
    if (el.matches(':focus-visible')) showTip(el);
  };

  const onBlur = (e) => {
    if (!gridRef.current?.contains(e.relatedTarget)) hideTip();
  };

  // Arrow keys move focus between tiles, and only while a tile has focus.
  const onKeyDown = (e) => {
    const el = e.target;
    if (!el.classList?.contains('wall-tile')) return;
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    let next = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const step = e.key === 'ArrowLeft' ? -1 : 1;
      const slots = rows[r].slots;
      for (let i = c + step; i >= 0 && i < slots.length && !next; i += step) next = slots[i];
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const row = rows[r + (e.key === 'ArrowUp' ? -1 : 1)];
      if (row) next = nearestInRow(row.slots, c);
    } else if (e.key === 'Home' || e.key === 'End') {
      const tiles = rows[r].slots.filter(Boolean);
      next = e.key === 'Home' ? tiles[0] : tiles[tiles.length - 1];
    } else {
      return;
    }
    e.preventDefault();
    if (!next) return;
    const target = tileEls.current.get(next.key);
    if (!target) return;
    setFocusKey(next.key);
    target.focus({ preventScroll: true });
    if (scrollRef.current) revealInScroller(scrollRef.current, target, 'auto');
  };

  const onClick = (e) => {
    const el = e.target.closest?.('.wall-tile');
    if (!el) return;
    const tile = tilesByKey.get(el.dataset.key);
    if (tile) onOpen(tile);
  };

  useImperativeHandle(ref, () => ({
    focusTile(key) {
      const el = tileEls.current.get(key) || tileEls.current.get(tabStop);
      el?.focus({ preventScroll: true });
    },
    /** The lucky-dip spotlight: hop across random tiles, then land on `key`. */
    async dip(key) {
      clearRipple();
      hideTip();
      const grid = gridRef.current;
      const sc = scrollRef.current;
      const els = [...tileEls.current.values()];
      if (!grid || els.length === 0) return;
      grid.closest('.wall-frame')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const place = (el, land) => {
        if (sc && sc.scrollWidth > sc.clientWidth) revealInScroller(sc, el, 'smooth');
        setSpot({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2, land, n: Math.random() });
      };
      for (const ms of HOP_DELAYS) {
        place(els[Math.floor(Math.random() * els.length)], false);
        await sleep(ms);
      }
      const target = tileEls.current.get(key);
      if (target) {
        place(target, true);
        await sleep(480);
      }
      setTimeout(() => setSpot(null), 1300);
    },
  }), [tabStop, tilesByKey]);

  useEffect(() => {
    if (rows.length) markPainted('wall-drawn', { region: regionKey, tiles: tilesByKey.size });
  }, [rows, regionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a stale spotlight or hover card when the wall itself changes.
  useEffect(() => {
    setTip(null);
    clearRipple();
  }, [regionKey]);

  const months = rows.length ? monthColumns(rows[0].year) : [];

  return (
    <div className={`wall-frame${dipping ? ' is-dipping' : ''}`} style={{ '--cols': columns }}>
      <div className="wall-scroll" ref={scrollRef} onScroll={tip ? hideTip : undefined}>
        <div
          className="wall-grid"
          ref={gridRef}
          role="group"
          aria-label={isAll ? 'Weeks archived in any region, by year' : 'Archived editions, by year'}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          onPointerOver={onPointerOver}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
        >
          <div className="wall-months" aria-hidden="true">
            <span className="wall-year" />
            {months.map((col, i) => (
              <span key={MONTHS[i]} className="wall-month" style={{ gridColumn: col + 2 }}>{MONTHS[i]}</span>
            ))}
          </div>
          <WallRows
            key={regionKey}
            rows={rows}
            isAll={isAll}
            selectedKey={selectedKey}
            latestKey={latestKey}
            tabStop={tabStop}
          />
          {spot && (
            <span
              key={spot.land ? 'land' : 'hop'}
              className={`wall-spot${spot.land ? ' is-land' : ''}`}
              style={{ left: spot.x, top: spot.y }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      {tip && <WallTip tip={tip} isAll={isAll} />}
    </div>
  );
}

// Each row is memoised on plain values (the columns of its selected, latest
// and Tab-stop tiles), so opening an edition or moving the Tab stop
// re-renders only the one or two rows involved, not all ~640 buttons.
const rowColumns = new WeakMap(); // row → Map(tile key → column)
function columnOf(row, key) {
  if (!key) return -1;
  let cols = rowColumns.get(row);
  if (!cols) {
    cols = new Map();
    row.slots.forEach((t, c) => t && cols.set(t.key, c));
    rowColumns.set(row, cols);
  }
  return cols.has(key) ? cols.get(key) : -1;
}

const WallRows = memo(function WallRows({ rows, isAll, selectedKey, latestKey, tabStop }) {
  return rows.map((row, r) => {
    const colOf = key => columnOf(row, key);
    return (
      <WallRow
        key={row.year}
        row={row}
        r={r}
        isAll={isAll}
        selectedCol={colOf(selectedKey)}
        latestCol={colOf(latestKey)}
        tabStopCol={colOf(tabStop)}
      />
    );
  });
});

const WallRow = memo(function WallRow({ row, r, isAll, selectedCol, latestCol, tabStopCol }) {
  return (
    <div className="wall-row" role="group" aria-label={String(row.year)}>
      <span className="wall-year" aria-hidden="true">{row.year}</span>
      {row.slots.map((tile, c) => {
        if (!tile) return <span key={c} className="wall-empty" style={{ gridColumn: c + 2 }} aria-hidden="true" />;
        const selected = c === selectedCol;
        return (
          <button
            key={c}
            type="button"
            className={`wall-tile step-${tile.step}${selected ? ' is-selected' : ''}${c === latestCol ? ' is-latest' : ''}`}
            style={{ gridColumn: c + 2, '--d': `${Math.min(r, 12) * 55 + c * 6}ms` }}
            data-key={tile.key}
            data-r={r}
            data-c={c}
            tabIndex={c === tabStopCol ? 0 : -1}
            aria-label={tileLabel(tile, isAll)}
            aria-pressed={selected}
          />
        );
      })}
    </div>
  );
});

function WallTip({ tip, isAll }) {
  const { tile } = tip;
  return (
    <div className={`wall-tip${tip.below ? ' is-below' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden="true">
      <strong>{isAll ? `Week of ${formatLongDate(tile.date)}` : formatLongDate(tile.date)}</strong>
      {isAll ? (
        <span className="wall-tip-regions">
          {tile.editions.map(e => <b key={e.region} data-region={e.region}>{e.region}</b>)}
        </span>
      ) : (
        <span className="wall-tip-count"><b>{tile.trackCount}</b> tracks</span>
      )}
      {!isAll && tile.editions[0].tuesday && <span className="wall-tip-note">New Music Tuesday</span>}
    </div>
  );
}

function nearestInRow(slots, col) {
  for (let d = 0; d < slots.length; d++) {
    if (slots[col - d]) return slots[col - d];
    if (slots[col + d]) return slots[col + d];
  }
  return null;
}

/** Scroll a horizontal scroller so `el` sits clear of the sticky year labels. */
function revealInScroller(sc, el, behavior) {
  const scRect = sc.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const labelWidth = 60;
  const left = r.left - scRect.left;
  if (left >= labelWidth && r.right <= scRect.right - 8) return;
  const target = sc.scrollLeft + left - labelWidth - (sc.clientWidth - labelWidth) / 2;
  sc.scrollTo({ left: Math.max(0, target), behavior });
}

export default Wall;
