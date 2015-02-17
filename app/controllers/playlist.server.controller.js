'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  moment = require('moment'),
  errorHandler = require('./errors.server.controller'),
  Playlist = mongoose.model('Playlist'),
  _ = require('lodash');

/**
 * Create a Spotify
 */
exports.create = function(req, res, tracks) {
  var playlist = new Playlist(tracks);

  var title = moment().format('MM-DD-YYYY');
  playlist.title = title;
  playlist.tracks = tracks;

  playlist.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(playlist);
    }
  });
};

/**
 * Show the current Spotify
 */
exports.read = function(req, res) {

};

/**
 * Update a Spotify
 */
exports.update = function(req, res) {

};

/**
 * Delete an Spotify
 */
exports.delete = function(req, res) {

};

/**
 * List of Spotifies
 */
exports.list = function(req, res) {
  Playlist.find().sort('-published_date').exec(function(err, playlists) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(playlists);
    }
  });
};
