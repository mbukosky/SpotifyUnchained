'use strict';

/**
 * Lets set the environment variable for heroku
 * This file is not checked into source control
 */
var envs_exist = require('fs').existsSync('./config/env/heroku.js');
if (envs_exist) {
  require('./config/env/heroku.js')();
}

// Init the new relic application
require('newrelic');

/**
 * Module dependencies.
 */
var init = require('./config/init')(),
  config = require('./config/config'),
  mongoose = require('mongoose'),
  chalk = require('chalk');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

// Bootstrap db connection
mongoose.connect(config.db,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  },
  function (err) {
    if (err) {
      console.error(chalk.red('Could not connect to MongoDB!'));
      console.log(chalk.red(err));
    }
  });

// Init the express application
var app = require('./config/express')(mongoose);

// Bootstrap passport config
require('./config/passport')();

// Start the app by listening on <port>
app.listen(config.port);

// Expose app
exports = module.exports = app;

// Logging initialization
console.log('MEAN.JS application started on port ' + config.port);