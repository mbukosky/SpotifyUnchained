import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { getCurrentUser } from '../lib/spotify';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES = 'playlist-modify-public playlist-modify-private';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_KEY = 'spotify_access_token';
const REFRESH_KEY = 'spotify_refresh_token';
const EXPIRES_KEY = 'spotify_expires_at';

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => chars[v % chars.length]).join('');
}

async function computeCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const SpotifyAuthContext = createContext(null);

export function SpotifyAuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem(REFRESH_KEY));
  const [expiresAt, setExpiresAt] = useState(() => {
    const v = localStorage.getItem(EXPIRES_KEY);
    return v ? Number(v) : 0;
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!accessToken && Date.now() < expiresAt;

  const storeTokens = useCallback((access, refresh, expiresIn) => {
    const expiry = Date.now() + expiresIn * 1000;
    setAccessToken(access);
    setRefreshToken(refresh);
    setExpiresAt(expiry);
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(EXPIRES_KEY, String(expiry));
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setExpiresAt(0);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return;
    try {
      const res = await fetch('/api/spotify/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      storeTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
    } catch {
      logout();
    }
  }, [refreshToken, storeTokens, logout]);

  const login = useCallback(async () => {
    const verifier = generateRandomString(128);
    const challenge = await computeCodeChallenge(verifier);
    sessionStorage.setItem('spotify_code_verifier', verifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    window.location.href = `${AUTH_URL}?${params}`;
  }, []);

  // Handle callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const verifier = sessionStorage.getItem('spotify_code_verifier');
    if (!verifier) return;

    setLoading(true);
    sessionStorage.removeItem('spotify_code_verifier');

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);

    fetch('/api/spotify/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, redirect_uri: REDIRECT_URI }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Token exchange failed');
        return res.json();
      })
      .then(data => {
        storeTokens(data.access_token, data.refresh_token, data.expires_in);
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [storeTokens, logout]);

  // Fetch user profile when authenticated
  useEffect(() => {
    if (!accessToken || !isAuthenticated) return;
    getCurrentUser(accessToken)
      .then(setUser)
      .catch(() => {});
  }, [accessToken, isAuthenticated]);

  // Auto-refresh 5 minutes before expiry
  useEffect(() => {
    if (!refreshToken || !expiresAt) return;
    const msUntilRefresh = expiresAt - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) {
      refreshAccessToken();
      return;
    }
    const timer = setTimeout(refreshAccessToken, msUntilRefresh);
    return () => clearTimeout(timer);
  }, [expiresAt, refreshToken, refreshAccessToken]);

  const value = { user, isAuthenticated, loading, login, logout, accessToken };

  return (
    <SpotifyAuthContext.Provider value={value}>
      {children}
    </SpotifyAuthContext.Provider>
  );
}

export function useSpotifyAuth() {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error('useSpotifyAuth must be used within SpotifyAuthProvider');
  return ctx;
}
