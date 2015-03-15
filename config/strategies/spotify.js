'use strict';

/**
 * Module dependencies.
 */
var passport = require('passport'),
  refresh = require('passport-oauth2-refresh'),
  SpotifyStrategy = require('passport-spotify').Strategy,
  config = require('../config'),
  users = require('../../app/controllers/users.server.controller');

module.exports = function() {
  // Use spotify strategy
  var strategy = new SpotifyStrategy({
      clientID: config.spotify.clientID,
      clientSecret: config.spotify.clientSecret,
      callbackURL: config.spotify.callbackURL,
    },
    function(req, accessToken, refreshToken, profile, done) {
      // Set the provider data and include tokens
      var providerData = profile._json;

      /**
       * NOTE: There is a bug in passport where the accessToken and
       * refresh token and swapped. I am patching this in the strategy
       * so I don't have to apply this backwards logic throughout the app
       */
      providerData.accessToken = refreshToken.access_token;
      providerData.refreshToken = accessToken;

      // Create the user OAuth profile
      var providerUserProfile = {
        displayName: profile.displayName || profile.id,
        username: profile.id,
        provider: 'spotify',
        providerIdentifierField: 'id',
        providerData: providerData
      };

      // Save the user OAuth profile
      users.saveOAuthUserProfile(req, providerUserProfile, done);
    }
  );

  passport.use(strategy);
  refresh.use(strategy);
};
