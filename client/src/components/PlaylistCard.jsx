import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import TrackItem from './TrackItem';
import SavePlaylist from './SavePlaylist';
import PlaylistDownload from './PlaylistDownload';
import { REGION_COLORS } from '../lib/regions';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function generateWaveformBars() {
  const bars = 36;
  const rects = [];
  for (let i = 0; i < bars; i++) {
    const x = (i / bars) * 180;
    const h = 4 + Math.random() * 24;
    const y = 17 - h / 2;
    rects.push({ x, y, h, key: i });
  }
  return rects;
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
  // The entrance animation's fill-mode would override the inline tilt
  // transform, so the tilt only engages once the animation has finished.
  const [settled, setSettled] = useState(false);
  const cardRef = useRef(null);
  const trackListRef = useRef(null);
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

  const waveformBars = useMemo(() => generateWaveformBars(), []);

  const togglePlay = (trackId) => {
    setActiveTrack(prev => prev === trackId ? null : trackId);
  };

  const handleTilt = (e) => {
    const card = cardRef.current;
    if (!card || !settled || expanded || REDUCED_MOTION) return;
    const r = card.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateX(${(-dy * 3).toFixed(2)}deg) rotateY(${(dx * 3).toFixed(2)}deg) translateZ(4px)`;
  };

  const resetTilt = () => {
    if (cardRef.current) cardRef.current.style.transform = '';
  };

  const region = playlist.region || 'US';

  return (
    <article
      ref={cardRef}
      className={`pcard${expanded ? ' open' : ''}${settled ? ' settled' : ''}`}
      style={{ animationDelay: `${(index + 1) * 0.08}s`, '--rc': REGION_COLORS[region] }}
      data-region={region}
      onMouseMove={handleTilt}
      onMouseLeave={resetTilt}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSettled(true); }}
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
        <svg className="pcard-wave" viewBox="0 0 180 34" preserveAspectRatio="none" aria-hidden="true">
          {waveformBars.map(b => (
            <rect key={b.key} x={b.x} y={b.y} width="2.6" height={b.h} rx="1.3" />
          ))}
        </svg>
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
