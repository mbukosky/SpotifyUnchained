'use strict';

/**
 * Module dependencies.
 */

/**
 * Create a Log
 * { message: 'xxx', logType: 'warn' }
 */
exports.log = function(req, res) {
  var msg = req.body;

  if (!msg) {
    res.status(400).send({
      message: 'invalid request'
    });
  } else {
    //use console so I can pick up information in log file on heroku
    console[msg.logType]('client %s: %s', msg.logType, JSON.stringify(msg.message));

    return res.status(200).end();
  }
};
