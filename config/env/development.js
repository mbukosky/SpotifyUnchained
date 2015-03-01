'use strict';

module.exports = {
  db: 'mongodb://localhost/spotifyunchained-dev',
  app: {
    title: 'SpotifyUnchained - Development Environment'
  },
  spotify: {
    clientID: process.env.SPOTIFY_CLIENT_ID || 'APP_ID',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'APP_SECRET',
    callbackURL: '/auth/spotify/callback'
  },
  mailer: {
    from: process.env.MAILER_FROM || 'MAILER_FROM',
    options: {
      service: process.env.MAILER_SERVICE_PROVIDER || 'MAILER_SERVICE_PROVIDER',
      auth: {
        user: process.env.MAILER_EMAIL_ID || 'MAILER_EMAIL_ID',
        pass: process.env.MAILER_PASSWORD || 'MAILER_PASSWORD'
      }
    }
  }
};