'use strict';

/**
 * Module dependencies.
 */
var request = require('request'),
  playlist = require('./playlist.server.controller'),
  _ = require('lodash');

var client_id = process.env.SPOTIFY_CLIENT_ID || 'client';
var client_secret = process.env.SPOTIFY_CLIENT_SECRET || 'secret';
var playlist_id = '37i9dQZF1DX4JAvHpjipBk';

var authOptions = {
  url: 'https://accounts.spotify.com/api/token',
  headers: {
    'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
  },
  form: {
    grant_type: 'client_credentials'
  },
  json: true
};

var saveTracks = function(data) {

  var tracks = [];

  try {
    data.items.forEach(function(item) {
        if(!_.isNull(item.track)) {
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

  var req = function() {};
  var res = {
    json: function(playlist) {
      console.log('Saved ' + playlist.title);
    }
  };

  playlist.create(req, res, tracks);
};

/**
 * Sync a Spotify playlist by fetching the results and saving them to the database
 */
exports.sync = function(req, res) {
  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {

      // use the access token to access the Spotify Web API
      var token = body.access_token;
      console.log('TOKEN: ' + token);

      var options = {
        url: 'https://api.spotify.com/v1/users/spotify/playlists/' + playlist_id + '/tracks',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        json: true
      };

      request.get(options, function(error, response, body) {
        saveTracks(body);
      });
    }

    //TODO: Added error logging
  });
};
