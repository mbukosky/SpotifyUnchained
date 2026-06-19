import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

export default function SessionExpiredBanner() {
  const { sessionExpired, login, dismissSessionExpired, loading } = useSpotifyAuth();

  if (!sessionExpired) return null;

  return (
    <div className="session-banner" role="alert">
      <div className="session-banner-inner">
        <span className="session-banner-text">
          Your Spotify session expired — please sign in again.
        </span>
        <div className="session-banner-actions">
          <button className="session-banner-signin" onClick={login} disabled={loading}>
            Sign in
          </button>
          <button
            className="session-banner-dismiss"
            onClick={dismissSessionExpired}
            aria-label="Dismiss notification"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
