import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing the controller
vi.mock('../config.js', () => ({
  default: {
    spotifyClientId: 'test-client-id',
    spotifyClientSecret: 'test-client-secret',
  },
}));

import { exchangeToken, refreshToken } from './spotify.js';

function mockReqRes(body = {}) {
  const req = { body };
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('exchangeToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when code is missing', async () => {
    const { req, res } = mockReqRes({ code_verifier: 'v', redirect_uri: 'http://localhost:3000/callback' });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required parameters: code, code_verifier, redirect_uri' });
  });

  it('returns 400 when code_verifier is missing', async () => {
    const { req, res } = mockReqRes({ code: 'c', redirect_uri: 'http://localhost:3000/callback' });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when redirect_uri is missing', async () => {
    const { req, res } = mockReqRes({ code: 'c', code_verifier: 'v' });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for disallowed redirect_uri', async () => {
    const { req, res } = mockReqRes({
      code: 'c',
      code_verifier: 'v',
      redirect_uri: 'https://evil.example.com/callback',
    });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid redirect_uri' });
  });

  it('calls Spotify API with correct params on valid input', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'at', expires_in: 3600, refresh_token: 'rt' }),
    });

    const { req, res } = mockReqRes({
      code: 'auth-code',
      code_verifier: 'verifier',
      redirect_uri: 'http://localhost:3000/callback',
    });
    await exchangeToken(req, res);

    expect(fetch).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: expect.any(URLSearchParams),
    });

    const body = fetch.mock.calls[0][1].body;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
  });

  it('returns access_token, expires_in, refresh_token on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'at', expires_in: 3600, refresh_token: 'rt', extra_field: 'ignored' }),
    });

    const { req, res } = mockReqRes({
      code: 'c',
      code_verifier: 'v',
      redirect_uri: 'http://localhost:3000/callback',
    });
    await exchangeToken(req, res);

    expect(res.json).toHaveBeenCalledWith({
      access_token: 'at',
      expires_in: 3600,
      refresh_token: 'rt',
    });
  });

  it('returns upstream status code on Spotify error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'invalid_grant' }),
    });

    const { req, res } = mockReqRes({
      code: 'c',
      code_verifier: 'v',
      redirect_uri: 'http://localhost:3000/callback',
    });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token exchange failed' });
  });

  it('returns 500 on network/unexpected error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { req, res } = mockReqRes({
      code: 'c',
      code_verifier: 'v',
      redirect_uri: 'http://localhost:3000/callback',
    });
    await exchangeToken(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token exchange failed' });
  });
});

describe('refreshToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when refresh_token is missing', async () => {
    const { req, res } = mockReqRes({});
    await refreshToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required parameter: refresh_token' });
  });

  it('returns tokens on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-at', expires_in: 3600, refresh_token: 'new-rt' }),
    });

    const { req, res } = mockReqRes({ refresh_token: 'old-rt' });
    await refreshToken(req, res);

    expect(res.json).toHaveBeenCalledWith({
      access_token: 'new-at',
      expires_in: 3600,
      refresh_token: 'new-rt',
    });
  });

  it('handles Spotify error responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    });

    const { req, res } = mockReqRes({ refresh_token: 'bad-rt' });
    await refreshToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token refresh failed' });
  });
});
