import config from '../config.js';

const allowedRedirectUris = (process.env.ALLOWED_REDIRECT_URIS || 'http://localhost:5173/callback,http://localhost:3000/callback')
  .split(',')
  .map(u => u.trim());

export async function exchangeToken(req, res) {
  try {
    const { code, code_verifier, redirect_uri } = req.body;

    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters: code, code_verifier, redirect_uri' });
    }

    if (!allowedRedirectUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'Invalid redirect_uri' });
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier,
        redirect_uri,
        client_id: config.spotifyClientId,
        client_secret: config.spotifyClientSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Spotify token exchange error:', data);
      return res.status(response.status).json({ error: 'Token exchange failed' });
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    console.error('Error exchanging token:', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing required parameter: refresh_token' });
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: config.spotifyClientId,
        client_secret: config.spotifyClientSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Spotify token refresh error:', data);
      return res.status(response.status).json({ error: 'Token refresh failed' });
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}
