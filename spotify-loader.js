'use strict';

// Load up my private env
require('./config/env/heroku')();

var config = require('./config/config'),
  mongoose = require('mongoose'),
  path = require('path'),
  chalk = require('chalk'),
  SpotifyWebApi = require('spotify-web-api-node');

/**
 * Database, models, and helpers
 */

mongoose.connect(config.db, function(err) {
  if (err) {
    console.error(chalk.red('Could not connect to MongoDB!'));
    console.log(chalk.red(err));
  }
});

require(path.resolve('./app/models/playlist.server.model.js'));
var Playlist = mongoose.model('Playlist');

var create = function(title, tracks, done) {
  var playlist = new Playlist(tracks);

  playlist.title = title
  playlist.tracks = tracks;

  var upsertData = playlist.toObject();

  delete upsertData._id;

  Playlist.update({
      title: playlist.title
    }, upsertData, {
      upsert: true
    },
    function(err) {
      if (err) {
        done(errorHandler.getErrorMessage(err))
      } else {
        done(playlist);
      }
    });
};

/**
 * Spotify Api
 */

var spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientID,
  clientSecret: config.spotify.clientSecret,
  redirectUri: config.spotify.callbackURL
});

var user = 'andreuha';
var playlist = '3BLx9ad3ju8fErQE3q1YXr';

var savePlaylist = function(data) {

  var tracks = [];
  data.tracks.items.forEach(function(item) {
    tracks.push({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists[0].name,
      added_at: item.added_at,
      open_url: item.track.external_urls.spotify,
      uri: item.track.uri
    });
  });

  var title = data.name;
  create(title, tracks, function(data) {
    console.log('[' + chalk.green(title) + ']' + ' saved!');
  });
};

/**
 * --Main entry point--
 * Call out to Spotify and save all the playlist tracks
 */

spotifyApi.clientCredentialsGrant()
  .then(function(data) {
    // console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + chalk.yellow(data.body['access_token']));

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);

    return spotifyApi.getPlaylist(user, playlist);
  })
  .then(function(data) {
    // Upsert to the database
    savePlaylist(data.body);
  })
  .catch(function(error) {
    console.log(chalk.red('Something went wrong when retrieving an access token'), err);
  });
