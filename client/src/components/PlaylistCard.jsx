import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import TrackItem from './TrackItem';
import SavePlaylist from './SavePlaylist';
import PlaylistDownload from './PlaylistDownload';
import { REGION_COLORS } from '../lib/regions';

function generateWaveformHeights() {
  return Array.from({ length: 36 }, () => Math.round(4 + Math.random() * 24));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const REGION_CODES = ['US', 'UK', 'CA', 'BR', 'MX', 'DE'];

function RegionTitle({ title }) {
  const parts = title.replace(/\./g, ' . ').split(/\b(US|UK|CA|BR|MX|DE)\b/);
  return parts.map((part, i) =>
    REGION_CODES.includes(part)
      ? <span key={i} className="region-accent">{part}</span>
      : part
  );
}

export default function PlaylistCard({ playlist, index }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);
  const trackListRef = useRef(null);
  const cardRef = useRef(null);
  const waveRef = useRef(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [maxHeight, setMaxHeight] = useState(0);

  // Measure the real content height so the expand animation never clips long
  // playlists (a fixed max-height cap clipped lists past ~26 tracks — issue #156).
  // The embed container animates its own max-height after this measurement runs,
  // so leave headroom for it whenever a track is playing.
  useLayoutEffect(() => {
    if (!trackListRef.current) return;
    const embedHeadroom = activeTrack ? 190 : 0;
    setMaxHeight(expanded ? trackListRef.current.scrollHeight + embedHeadroom : 0);
  }, [expanded, playlist.tracks.length, activeTrack]);

  const waveformHeights = useMemo(() => generateWaveformHeights(), []);

  // Clear any leftover tilt as soon as the card expands (pointer may not move).
  useEffect(() => {
    if (expanded && cardRef.current) cardRef.current.style.transform = '';
  }, [expanded]);

  // Mouse tilt on the card + waveform "pluck": bars near the cursor spring up.
  // Direct style mutation via refs so pointer movement never re-renders React.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) return;

    const resetWave = () => {
      const wave = waveRef.current;
      if (!wave) return;
      for (const bar of wave.children) {
        bar.style.setProperty('--h', bar.dataset.h);
        bar.style.opacity = '';
      }
    };

    const onPointerMove = (e) => {
      // Expanded cards are tall lists — don't tilt them.
      if (expandedRef.current) {
        card.style.transform = '';
      } else {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `rotateX(${py * -4}deg) rotateY(${px * 4}deg) translateY(-2px)`;
      }

      const wave = waveRef.current;
      if (!wave) return;
      const wr = wave.getBoundingClientRect();
      if (wr.width === 0) return; // waveform hidden at narrow widths
      const bars = wave.children;
      const inRange =
        e.clientX > wr.left - 40 && e.clientX < wr.right + 40 &&
        e.clientY > wr.top - 30 && e.clientY < wr.bottom + 30;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const bx = wr.left + (i + 0.5) * (wr.width / bars.length);
        const d = Math.abs(e.clientX - bx);
        if (inRange && d < 70) {
          const boost = (1 - d / 70) * 16;
          bar.style.setProperty('--h', Math.min(33, Number(bar.dataset.h) + boost));
          bar.style.opacity = '1';
        } else {
          bar.style.setProperty('--h', bar.dataset.h);
          bar.style.opacity = '';
        }
      }
    };

    const onPointerLeave = () => {
      card.style.transform = '';
      resetWave();
    };

    card.addEventListener('pointermove', onPointerMove, { passive: true });
    card.addEventListener('pointerleave', onPointerLeave);
    return () => {
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const togglePlay = (trackId) => {
    setActiveTrack(prev => prev === trackId ? null : trackId);
  };

  const region = playlist.region || 'US';

  return (
    <article
      ref={cardRef}
      className={`pcard${expanded ? ' open' : ''}`}
      style={{ animationDelay: `${(index + 1) * 0.08}s`, '--rc': REGION_COLORS[region] }}
      data-region={region}
    >
      <div
        className="pcard-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Toggle ${playlist.title}`}
        onClick={() => setExpanded(prev => !prev)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); } }}
      >
        <div className="pcard-orb" aria-hidden="true" />
        <div className="pcard-info">
          <h3 className="pcard-title"><RegionTitle title={playlist.title} /></h3>
          <div className="pcard-meta">
            <span>{formatDate(playlist.published_date)}</span>
            <span>{playlist.tracks.length} tracks</span>
          </div>
        </div>
        <div className="pcard-wave" ref={waveRef} aria-hidden="true">
          {waveformHeights.map((h, i) => (
            <i key={i} data-h={h} style={{ '--h': h }} />
          ))}
        </div>
        <PlaylistDownload playlist={playlist} />
        <svg className="pcard-chev" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 7.5 L10 12.5 L15 7.5" />
        </svg>
      </div>
      <div className="tracks" ref={trackListRef} style={{ maxHeight }}>
        <div className="tracks-inner">
          {playlist.tracks.map((track, i) => (
            <TrackItem
              key={track._id || track.id}
              track={track}
              index={i}
              isPlaying={activeTrack === track.id}
              onTogglePlay={togglePlay}
              autoplay
            />
          ))}
          <SavePlaylist playlist={playlist} />
        </div>
      </div>
    </article>
  );
}
