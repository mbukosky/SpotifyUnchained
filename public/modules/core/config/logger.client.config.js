'use strict';

// Setting up Logger config
angular.module('core').config(
  function(LOG_LOGGER_CONFIG) {
    LOG_LOGGER_CONFIG.remoteLogUrl = 'log';
    LOG_LOGGER_CONFIG.enabled = {
      global: true, //global flag to enable remote logging for all log operations
      warn: true,
      // error: true,
      info: true,
      log: true
    };
  }
);
