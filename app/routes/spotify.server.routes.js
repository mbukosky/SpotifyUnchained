'use strict';

const playlist = require('../../app/controllers/playlist.server.controller');

module.exports = function (app) {
	//Spotify routing

	app.route('/spotify')
		.get(playlist.list);

};
