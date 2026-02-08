import { useRegion } from '../hooks/useRegion';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import Equalizer from './Equalizer';
import ThemeToggle from './ThemeToggle';

const REGIONS = ['ALL', 'US', 'UK'];

export default function Header() {
  const { region, changeRegion } = useRegion();
  const { user, isAuthenticated, loading, login, logout } = useSpotifyAuth();

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark">
            <svg className="brand-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="15" stroke="var(--gold)" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="6" stroke="var(--gold)" strokeWidth="1" />
              <circle cx="16" cy="16" r="2" fill="var(--gold)" />
              <line x1="16" y1="1" x2="16" y2="10" stroke="var(--gold)" strokeWidth="0.5" opacity="0.4" />
              <line x1="31" y1="16" x2="22" y2="16" stroke="var(--gold)" strokeWidth="0.5" opacity="0.4" />
            </svg>
            <h1 className="brand-name">Spotify<span className="gold">Unchained</span></h1>
          </div>
          <Equalizer />
        </div>

        <nav className="header-controls">
          <div className="region-filter" role="group" aria-label="Region filter">
            {REGIONS.map(r => (
              <button
                key={r}
                className={`region-btn${region === r ? ' active' : ''}`}
                data-region={r}
                onClick={() => changeRegion(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <ThemeToggle />

          {isAuthenticated ? (
            <button className="spotify-auth-btn" onClick={logout} aria-label="Sign out of Spotify">
              <span className="spotify-user-name">{user?.display_name || 'User'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          ) : (
            <button className="spotify-auth-btn" onClick={login} disabled={loading} aria-label="Sign in with Spotify">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              <span>Sign in</span>
            </button>
          )}

          <a href="https://github.com/mbukosky/SpotifyUnchained" className="github-link" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </nav>
      </div>

      <svg className="header-waveform" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,20 Q50,5 100,20 T200,20 T300,20 T400,20 T500,20 T600,20 T700,20 T800,20 T900,20 T1000,20 T1100,20 T1200,20" fill="none" stroke="var(--gold)" strokeWidth="0.8" opacity="0.3" />
        <path d="M0,20 Q50,35 100,20 T200,20 T300,20 T400,20 T500,20 T600,20 T700,20 T800,20 T900,20 T1000,20 T1100,20 T1200,20" fill="none" stroke="var(--gold)" strokeWidth="0.5" opacity="0.15" />
      </svg>
    </header>
  );
}
