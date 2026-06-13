import { useRef, useEffect } from 'react';

export default function TrackItem({ track, index, isPlaying, onTogglePlay, autoplay }) {
  const iframeRef = useRef(null);

  // Use Spotify IFrame API to trigger play when autoplay is requested
  useEffect(() => {
    if (!isPlaying || !autoplay) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    // The Spotify Embed API allows controlling via window.onSpotifyIframeApiReady
    // but the simplest reliable approach is using the Spotify IFrame messaging API.
    // We listen for the iframe to load, then send a toggle command.
    const handleLoad = () => {
      // Small delay to let the embed initialize, then send play command
      setTimeout(() => {
        iframe.contentWindow?.postMessage({ command: 'toggle' }, 'https://open.spotify.com');
      }, 500);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [isPlaying, autoplay]);

  const handleRowClick = (e) => {
    // Don't trigger if clicking the external link
    if (e.target.closest('.track-open')) return;
    onTogglePlay(track.id);
  };

  return (
    <>
      <div
        className={`track-row${isPlaying ? ' playing-row' : ''}`}
        style={{ '--i': index }}
        data-track-id={track.id}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTogglePlay(track.id); } }}
      >
        <span className="track-num">{String(index + 1).padStart(2, '0')}</span>
        <button
          className={`track-play${isPlaying ? ' playing' : ''}`}
          onClick={(e) => { e.stopPropagation(); onTogglePlay(track.id); }}
          aria-label={isPlaying ? `Pause ${track.name}` : `Play ${track.name}`}
          tabIndex={-1}
        >
          <svg className="tri" width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.5 L10.5 6 L3 10.5 Z" />
          </svg>
          <span className="eq-mini" aria-hidden="true">
            <i style={{ height: '60%' }} /><i style={{ height: '100%' }} /><i style={{ height: '40%' }} />
          </span>
        </button>
        <div className="track-details">
          <div className="track-name">{track.name}</div>
          <div className="track-artist">{track.artist}</div>
        </div>
        <a href={track.open_url} target="_blank" rel="noopener noreferrer" className="track-open" aria-label={`Open ${track.name} on Spotify`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
      <div className={`track-embed-container${isPlaying ? ' active' : ''}`}>
        {isPlaying && (
          <iframe
            ref={iframeRef}
            src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title={`Spotify embed: ${track.name}`}
          />
        )}
      </div>
    </>
  );
}
