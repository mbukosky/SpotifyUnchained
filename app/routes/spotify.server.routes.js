'use strict';

const playlist = require('../../app/controllers/playlist.server.controller');
const spotify = require('../../app/controllers/spotify.server.controller');

module.exports = function (app) {
	//Spotify routing

	app.route('/spotify')
		.get(playlist.list);

	// OAuth token exchange (PKCE flow)
	app.route('/api/spotify/token')
		.post(spotify.exchangeToken);

	app.route('/api/spotify/refresh')
		.post(spotify.refreshToken);
};
