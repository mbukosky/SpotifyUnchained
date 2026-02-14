import { useState, useMemo } from 'react';
import TrackItem from './TrackItem';
import SavePlaylist from './SavePlaylist';
import PlaylistDownload from './PlaylistDownload';

function generateWaveformBars() {
  const bars = 30;
  const rects = [];
  for (let i = 0; i < bars; i++) {
    const x = (i / bars) * 120;
    const h = 4 + Math.random() * 22;
    const y = 15 - h / 2;
    rects.push({ x, y, h, key: i });
  }
  return rects;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function RegionTitle({ title, region }) {
  const parts = title.replace(/\./g, ' . ').split(/\b(US|UK)\b/);
  return parts.map((part, i) =>
    (part === 'US' || part === 'UK')
      ? <span key={i} className="region-accent">{part}</span>
      : part
  );
}

export default function PlaylistCard({ playlist, index }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTrack, setActiveTrack] = useState(null);

  const waveformBars = useMemo(() => generateWaveformBars(), []);

  const togglePlay = (trackId) => {
    setActiveTrack(prev => prev === trackId ? null : trackId);
  };

  const region = playlist.region || 'US';

  return (
    <article
      className={`playlist-card${expanded ? ' expanded' : ''}`}
      style={{ animationDelay: `${(index + 1) * 0.1}s` }}
      data-region={region}
    >
      <div
        className="playlist-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Toggle ${playlist.title}`}
        onClick={() => setExpanded(prev => !prev)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); } }}
      >
        <svg className="playlist-vinyl-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="20" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
          <circle cx="22" cy="22" r="14" stroke="var(--accent)" strokeWidth="0.5" opacity="0.3" />
          <circle cx="22" cy="22" r="8" stroke="var(--accent)" strokeWidth="0.5" opacity="0.3" />
          <circle cx="22" cy="22" r="3" fill="var(--accent)" opacity="0.6" />
          <circle cx="22" cy="22" r="1" fill="var(--bg-primary)" />
        </svg>
        <div className="playlist-info">
          <h3 className="playlist-title"><RegionTitle title={playlist.title} region={region} /></h3>
          <div className="playlist-meta">
            <span>{formatDate(playlist.published_date)}</span>
            <span>{playlist.tracks.length} tracks</span>
          </div>
        </div>
        <svg className="playlist-waveform" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
          {waveformBars.map(b => (
            <rect key={b.key} x={b.x} y={b.y} width="2.5" height={b.h} rx="1.25" fill="var(--accent)" opacity="0.5" />
          ))}
        </svg>
        <PlaylistDownload playlist={playlist} />
        <svg className="playlist-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 7.5 L10 12.5 L15 7.5" />
        </svg>
      </div>
      <div className="track-list">
        <div className="track-list-inner">
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
