'use strict';

/**
 * Module dependencies.
 */
var passport = require('passport');

module.exports = function(app) {
  // User Routes
  var users = require('../../app/controllers/users.server.controller');

  // Setting up the users profile api
  app.route('/users/me').get(users.me);
  app.route('/users').put(users.update);
  app.route('/users/accounts').delete(users.removeOAuthProvider);

  // Setting up the users authentication api
  app.route('/auth/signin').post(users.signin);
  app.route('/auth/signout').get(users.signout);

  // Setting the spotify oauth routes
  app.route('/auth/spotify').get(passport.authenticate('spotify', {
    scope: ['playlist-read-private', 'playlist-modify-private']
  }));
  app.route('/auth/spotify/callback').get(users.oauthCallback('spotify'));
  app.route('/auth/spotify/refresh').get(users.oauthRefresh('spotify'));

  // Finish by binding the user middleware
  app.param('userId', users.userByID);
};