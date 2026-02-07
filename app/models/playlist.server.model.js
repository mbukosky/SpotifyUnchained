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
  region: {
    type: String,
    required: true,
    enum: ['US', 'UK'],
    default: 'US'
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

PlaylistSchema.index({ region: 1, published_date: -1 });

mongoose.model('Playlist', PlaylistSchema);