'use strict';

module.exports = function(app) {
  // Root routing
  var core = require('../../app/controllers/core.server.controller');
  app.route('/').get(core.index);

  //TODO: install node-schedule
  //var schedule = require('node-schedule');

  //var rule = new schedule.RecurrenceRule();
  //rule.second = [0, 20, 40];

  // var j = schedule.scheduleJob(rule, function(){
  //     spotify.list();
  // });

  var spotify = require('../../app/controllers/spotify.server.controller');
  spotify.sync();
};
