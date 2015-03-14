'use strict';

var logger = require('../../app/controllers/logger.server.controller');

module.exports = function(app) {
  // Logger routing
  app.route('/log').post(logger.log);
};
