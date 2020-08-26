'use strict';

/**
 * Module dependencies.
 */
const fs = require('fs'),
  https = require('https'),
  express = require('express'),
  morgan = require('morgan'),
  compress = require('compression'),
  helmet = require('helmet'),
  config = require('./config'),
  path = require('path');

module.exports = function (mongoose) {
  // Initialize express app
  const app = express();

  // Globbing model files
  config.getGlobbedFiles('./app/models/**/*.js').forEach(function (modelPath) {
    require(path.resolve(modelPath));
  });

  // Should be placed before express.static
  app.use(compress({
    filter: function (req, res) {
      return (/json|text|javascript|css/).test(res.getHeader('Content-Type'));
    },
    level: 9
  }));

  // Showing stack errors
  app.set('showStackError', true);

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
    // Enable logger (morgan)
    app.use(morgan('dev'));
  } else if (process.env.NODE_ENV === 'production') {
    app.locals.cache = 'memory';
  }

  // Use helmet to secure Express headers
  app.use(helmet.frameguard());
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());
  app.use(helmet.ieNoOpen());
  app.disable('x-powered-by');

  // Setting the app router and static folder
  app.use(express.static(path.resolve('./dist/SpotifyUnchained')));

  // Globbing routing files
  config.getGlobbedFiles('./app/routes/**/*.js').forEach(function (routePath) {
    require(path.resolve(routePath))(app);
  });

  // Assume 'not found' in the error msgs is a 404. this is somewhat silly, but valid, you can do whatever you like, set properties, use instanceof etc.
  app.use(function (err, req, res, next) {
    // If the error object doesn't exists
    if (!err) return next();

    // Log it
    console.error(err.stack);

    // Error page
    res.status(500).send({
      error: 'Internal error'
    });
  });

  // Assume 404 since no middleware responded
  app.use(function (req, res) {
    res.status(404).send({
      url: req.originalUrl,
      error: 'Not Found'
    });
  });

  if (process.env.NODE_ENV === 'secure') {
    // Log SSL usage
    console.log('Securely using https protocol');

    // Load SSL key and certificate
    const privateKey = fs.readFileSync('./config/sslcerts/key.pem', 'utf8');
    const certificate = fs.readFileSync('./config/sslcerts/cert.pem', 'utf8');

    // Create HTTPS Server
    const httpsServer = https.createServer({
      key: privateKey,
      cert: certificate
    }, app);

    // Return HTTPS server instance
    return httpsServer;
  }

  // Return Express server instance
  return app;
};