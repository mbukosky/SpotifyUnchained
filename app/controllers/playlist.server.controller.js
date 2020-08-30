'use strict';

/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const moment = require('moment');
const errorHandler = require('./errors.server.controller');
const Playlist = mongoose.model('Playlist');

const getRecentFriday = () => {
  return moment()
    .subtract(5, 'days')
    .startOf('week')
    .add(5, 'days')
    .format('MM.DD.YYYY');
};

const getNewFridayTitle = () => {
  return 'New.Music.Friday.' + getRecentFriday();
};

/**
 * Create a Spotify
 */
exports.create = function (req, res, tracks) {
  const playlist = new Playlist(tracks);

  playlist.title = getNewFridayTitle();
  playlist.tracks = tracks;

  const upsertData = playlist.toObject();

  delete upsertData._id;

  Playlist.updateOne({
    title: playlist.title
  }, upsertData, {
    upsert: true
  }).then(() => res.json(playlist))
    .catch((err) => res.status(400).send({
      message: errorHandler.getErrorMessage(err)
    }));
};

/**
 * List of Spotifies
 */
exports.list = function (req, res) {
  //TODO: lodash numbers
  const pagesize = req.query.size || 5;
  const page = req.query.page || 1;
  const sort = req.query.sort || 'asc';

  const sortKey = sort === 'asc' ? 'published_date' : '-published_date';

  Promise.all([
    Playlist.countDocuments(),
    Playlist.find().sort(sortKey).skip(pagesize * (page - 1))
      .limit(Number(pagesize))
  ]).then(([count, playlists]) => {
    res.json({
      count,
      items: playlists,
    });
  }).catch((err) => {
    console.log(err);
    return res.status(400).send({
      message: errorHandler.getErrorMessage(err),
    });
  });
};
