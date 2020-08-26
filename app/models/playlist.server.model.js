'use strict';

/**
 * Module dependencies.
 */
const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/**
 * Playlist Schema
 */
const PlaylistSchema = new Schema({
  title: {
    type: String
  },
  published_date: {
    type: Date,
    default: Date.now
  },
  tracks: [{
    created: {
      type: Date,
      default: Date.now
    },
    id: {
      type: String
    },
    name: {
      type: String
    },
    artist: {
      type: String
    },
    open_url: {
      type: String
    },
    uri: {
      type: String
    },
    added_at: {
      type: Date
    }
  }]
});

mongoose.model('Playlist', PlaylistSchema);