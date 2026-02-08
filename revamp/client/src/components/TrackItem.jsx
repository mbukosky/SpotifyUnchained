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
        iframe.contentWindow?.postMessage({ command: 'toggle' }, '*');
      }, 500);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [isPlaying, autoplay]);

  const handleRowClick = (e) => {
    // Don't trigger if clicking the external link
    if (e.target.closest('.track-open-link')) return;
    onTogglePlay(track.id);
  };

  return (
    <>
      <div
        className={`track-item${isPlaying ? ' track-item-active' : ''}`}
        data-track-id={track.id}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTogglePlay(track.id); } }}
      >
        <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
        <button
          className={`track-play-btn${isPlaying ? ' active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onTogglePlay(track.id); }}
          aria-label={isPlaying ? `Pause ${track.name}` : `Play ${track.name}`}
          tabIndex={-1}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            {isPlaying ? (
              <>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </>
            ) : (
              <polygon points="6,4 20,12 6,20" />
            )}
          </svg>
        </button>
        <div className="track-details">
          <div className="track-name">{track.name}</div>
          <div className="track-artist">{track.artist}</div>
        </div>
        <a href={track.open_url} target="_blank" rel="noopener noreferrer" className="track-open-link" aria-label={`Open ${track.name} on Spotify`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
