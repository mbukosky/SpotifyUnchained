'use strict';

module.exports = function(app) {
  // Root routing
  var core = require('../../app/controllers/core.server.controller');
  app.route('/').get(core.index);

  // Kick off the first sync when the server starts up
  var spotify = require('../../app/controllers/spotify.server.controller');
  spotify.sync();

  // Schedule cron to sync every 2 hours
  var schedule = require('node-schedule');

  var rule = new schedule.RecurrenceRule();
  rule.hour = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  rule.minute = 0;

  var j = schedule.scheduleJob(rule, function() {
    spotify.sync();
  });
};
