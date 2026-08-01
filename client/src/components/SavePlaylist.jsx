import { useState } from 'react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { savePlaylist } from '../lib/spotify';

function messageFor(err) {
  switch (err?.status) {
    case 401:
      return 'Your Spotify session expired. Sign in again and retry.';
    case 403:
      return 'Spotify denied the request. Sign in again to grant playlist access.';
    case 429:
      return 'Spotify is busy right now. Try again in a minute.';
    default:
      return err?.message || 'Something went wrong saving this playlist.';
  }
}

export default function SavePlaylist({ playlist }) {
  const { user, isAuthenticated, login, accessToken } = useSpotifyAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      await savePlaylist(accessToken, {
        userId: user?.id,
        name: playlist.title.replace(/\./g, ' '),
        uris: (playlist.tracks || []).map(t => t.uri),
      });
      setStatus('success');
    } catch (err) {
      // Logged so anyone reporting a failure has something concrete to paste.
      console.error('Save to Spotify failed:', err);
      setError(messageFor(err));
      setStatus('error');
      setTimeout(() => setStatus('idle'), 6000);
    }
  };

  return (
    <div className="save-row">
    <button
      className={`save-btn ${status}`}
      onClick={handleSave}
      disabled={status === 'loading' || status === 'success'}
      aria-label="Save playlist to Spotify"
      title={status === 'error' ? error : undefined}
    >
      {status === 'idle' && (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z" />
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
    {status === 'error' && error && (
      <p className="save-error" role="alert">{error}</p>
    )}
    </div>
  );
}
