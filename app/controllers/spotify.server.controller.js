'use strict';

/**
 * Module dependencies.
 */
const nodeFetch = require('node-fetch');
const playlist = require('./playlist.server.controller');
const url = require('url');
const _ = require('lodash');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'client';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'secret';
const PLAYLIST_ID = '37i9dQZF1DX4JAvHpjipBk';

const params = new url.URLSearchParams();
params.append('grant_type', 'client_credentials');

const authOptions = {
  method: 'POST',
  body: params,
  headers: {
    'Authorization': 'Basic ' +
      (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')),
  },
};

const saveTracks = function (data) {

  const tracks = [];

  try {
    data.items.forEach(function (item) {
      if (!_.isNull(item.track)) {
        tracks.push({
          id: item.track.id,
          name: item.track.name,
          artist: item.track.artists[0].name,
          added_at: item.added_at,
          open_url: item.track.external_urls.spotify,
          uri: item.track.uri
        });
      }
    });
  } catch (err) {
    console.error('Unable to read track json', err);
    return;
  }

  const req = function () { };
  const res = {
    json: function (playlist) {
      console.log('Saved ' + playlist.title);
    }
  };

  playlist.create(req, res, tracks);
};

const downloadAdditionalTracks = async (body, options) => {
  let nextUrl = body.next;
  while (nextUrl) {
    console.log('Downloading additional page', nextUrl);
    const nextPageRes = await nodeFetch(nextUrl, options);
    const nextPage = await nextPageRes.json();
    nextUrl = nextPage.next;
    body.items = body.items.concat(nextPage.items);
  }
};

/**
 * Sync a Spotify playlist by fetching the results and saving them to the database
 */
/**
 * Exchange authorization code for access token (PKCE flow)
 */
exports.exchangeToken = async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const tokenParams = new url.URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('code', code);
  tokenParams.append('redirect_uri', redirect_uri);
  tokenParams.append('client_id', CLIENT_ID);
  tokenParams.append('client_secret', CLIENT_SECRET);
  tokenParams.append('code_verifier', code_verifier);

  try {
    const response = await nodeFetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      body: tokenParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Spotify token exchange error:', data);
      return res.status(response.status).json({ error: data.error_description || 'Token exchange failed' });
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token
    });
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  const tokenParams = new url.URLSearchParams();
  tokenParams.append('grant_type', 'refresh_token');
  tokenParams.append('refresh_token', refresh_token);
  tokenParams.append('client_id', CLIENT_ID);

  try {
    const response = await nodeFetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      body: tokenParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Spotify token refresh error:', data);
      return res.status(response.status).json({ error: data.error_description || 'Token refresh failed' });
    }

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token || refresh_token
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Sync a Spotify playlist by fetching the results and saving them to the database
 */
exports.sync = () => {
  return nodeFetch('https://accounts.spotify.com/api/token', authOptions)
    .then(async (res) => {
      const body = await res.json();
      const token = body.access_token;
      console.log('TOKEN: ' + token);

      const url = 'https://api.spotify.com/v1/users/spotify/playlists/' + PLAYLIST_ID + '/tracks';

      const options = {
        headers: {
          'Authorization': 'Bearer ' + token,
        },
      };

      const playlistRes = await nodeFetch(url, options);
      if (!playlistRes.ok) {
        throw (playlistRes.statusText);
      }
      const playlistBody = await playlistRes.json();
      if (playlistBody.next) {
        await downloadAdditionalTracks(playlistBody, options);
      }
      saveTracks(playlistBody);
    })
    .catch((err) => {
      console.error('Error downloading playlists:', err);
    });
};