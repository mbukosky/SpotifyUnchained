'use strict';

/**
* Module dependencies.
*/
var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
* Playlist Schema
*/
var PlaylistSchema = new Schema({
	title: {
		type: String,
    default: Date.now,
		trim: true
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
		open_url: {
			type: String
		},
		added_at: {
			type: Date
		}
	}]
});

mongoose.model('Playlist', PlaylistSchema);
