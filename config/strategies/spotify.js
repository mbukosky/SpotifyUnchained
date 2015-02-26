'use strict';

/**
 * Module dependencies.
 */
var passport = require('passport'),
  SpotifyStrategy = require('passport-spotify').Strategy,
  config = require('../config'),
  users = require('../../app/controllers/users.server.controller');

module.exports = function() {
  // Use spotify strategy
  passport.use(new SpotifyStrategy({
      clientID: config.spotify.clientID,
      clientSecret: config.spotify.clientSecret,
      callbackURL: config.spotify.callbackURL,
    },
    function(req, accessToken, refreshToken, profile, done) {
      // Set the provider data and include tokens
      var providerData = profile._json;
      providerData.accessToken = accessToken;
      providerData.refreshToken = refreshToken;

      // Create the user OAuth profile
      var providerUserProfile = {
        displayName: profile.displayName,
        username: profile.id,
        provider: 'spotify',
        providerIdentifierField: 'id',
        providerData: providerData
      };

      // Save the user OAuth profile
      users.saveOAuthUserProfile(req, providerUserProfile, done);
    }
  ));
};