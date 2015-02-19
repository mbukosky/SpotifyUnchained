'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  moment = require('moment'),
  errorHandler = require('./errors.server.controller'),
  Playlist = mongoose.model('Playlist'),
  _ = require('lodash');

var getRecentTuesday = function() {
  return moment()
    .startOf('week')
    .add(2, 'days')
    .format('MM.DD.YYYY');
};

var getNewTuesdayTitle = function() {
  return 'New.Tuesday.' + getRecentTuesday();
};

/**
 * Create a Spotify
 */
exports.create = function(req, res, tracks) {
  var playlist = new Playlist(tracks);

  playlist.title = getNewTuesdayTitle();
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