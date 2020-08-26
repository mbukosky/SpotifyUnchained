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