'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  moment = require('moment'),
  errorHandler = require('./errors.server.controller'),
  Playlist = mongoose.model('Playlist'),
  _ = require('lodash'),
  async = require('async');

var getRecentFriday = function() {
  return moment()
    .subtract(5, 'days')
    .startOf('week')
    .add(5, 'days')
    .format('MM.DD.YYYY');
};

var getNewFridayTitle = function() {
  return 'New.Music.Friday.' + getRecentFriday();
};

/**
 * Create a Spotify
 */
exports.create = function(req, res, tracks) {
  var playlist = new Playlist(tracks);

  playlist.title = getNewFridayTitle();
  playlist.tracks = tracks;

  var upsertData = playlist.toObject();

  delete upsertData._id;

  Playlist.updateOne({
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

function getPlaylists(pagesize, page, callback) {
  Playlist.find().sort('-published_date').skip(pagesize * (page - 1))
  .limit(Number(pagesize)).exec(callback);
}

function getPlaylistCount(callback) {
  Playlist.countDocuments().exec(callback);
}

/**
 * List of Spotifies
 */
exports.list = function(req, res) {
  //TODO: lodash numbers
  var pagesize = req.query.size || 5;
  var page = req.query.page || 1;

  async.parallel({
    count: getPlaylistCount,
    items: async.apply(getPlaylists, pagesize, page)
  }, function (err, results) {
    if (err) {
      console.log(err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }

    res.json(results);
  });
};
