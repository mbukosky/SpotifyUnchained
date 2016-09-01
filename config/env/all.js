'use strict';

module.exports = {
  app: {
    title: 'Unchaining Spotify - Archives of Spotify\'s New Music Tuesday & Friday',
    description: 'Archives of Spotify\'s New Music Tuesday & Friday',
    keywords: 'Spotify, playlist, new music tuesday, new music friday, archive, Node.js, AngularJS'
  },
  port: process.env.PORT || 3000,
  templateEngine: 'swig',
  sessionSecret: process.env.SESSION_SECRET || 'MEAN',
  sessionCollection: 'sessions',
  assets: {
    lib: {
      css: [
        'public/lib/bootstrap/dist/css/bootstrap.css',
        'public/lib/bootstrap/dist/css/bootstrap-theme.css',
      ],
      js: [
        'public/lib/angular/angular.js',
        'public/lib/angular-resource/angular-resource.js',
        'public/lib/angular-cookies/angular-cookies.js',
        'public/lib/angular-animate/angular-animate.js',
        'public/lib/angular-touch/angular-touch.js',
        'public/lib/angular-sanitize/angular-sanitize.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-ui-utils/ui-utils.js',
        'public/lib/angular-bootstrap/ui-bootstrap-tpls.js',
        'public/lib/angular-spotify/dist/angular-spotify.min.js',
        'public/lib/angular-remote-logger/dist/angular-remote-logger.min.js',
        'public/lib/ng-onload/release/ng-onload.min.js',
        'public/lib/angular-utils-pagination/dirPagination.js'
      ]
    },
    css: [
      'public/modules/**/css/*.css'
    ],
    js: [
      'public/config.js',
      'public/application.js',
      'public/modules/*/*.js',
      'public/modules/*/*[!tests]*/*.js'
    ],
    tests: [
      'public/lib/angular-mocks/angular-mocks.js',
      'public/modules/*/tests/*.js'
    ]
  }
};
