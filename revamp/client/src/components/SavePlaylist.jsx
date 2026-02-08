import { useState } from 'react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { createPlaylist, addPlaylistTracks } from '../lib/spotify';

export default function SavePlaylist({ playlist }) {
  const { user, isAuthenticated, login, accessToken } = useSpotifyAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleSave = async () => {
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
      className={`save-playlist-btn ${status}`}
      onClick={handleSave}
      disabled={status === 'loading' || status === 'success'}
      aria-label="Save playlist to Spotify"
    >
      {status === 'idle' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Save to Spotify</span>
        </>
      )}
      {status === 'loading' && (
        <>
          <span className="save-spinner" />
          <span>Saving...</span>
        </>
      )}
      {status === 'success' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Saved!</span>
        </>
      )}
      {status === 'error' && (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>Error</span>
        </>
      )}
    </button>
  );
}
