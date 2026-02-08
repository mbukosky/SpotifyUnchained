import { useState } from 'react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { createPlaylist, addPlaylistTracks } from '../lib/spotify';

export default function PlaylistDownload({ playlist }) {
  const { user, isAuthenticated, login, accessToken } = useSpotifyAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleClick = async (e) => {
    e.stopPropagation(); // prevent card expand/collapse

    if (!isAuthenticated) {
      login();
      return;
    }

    setStatus('loading');
    try {
      const uris = playlist.tracks.map(t => t.uri).filter(Boolean);
      const created = await createPlaylist(accessToken, user.id, playlist.title.replace(/\./g, ' '));
      await addPlaylistTracks(accessToken, created.id, uris);
      setStatus('success');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      className={`playlist-download-btn ${status}`}
      onClick={handleClick}
      disabled={status === 'loading' || status === 'success'}
      aria-label="Save playlist to Spotify"
      title="Save to Spotify"
    >
      {status === 'idle' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {status === 'loading' && (
        <span className="save-spinner" />
      )}
      {status === 'success' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {status === 'error' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )}
    </button>
  );
}
