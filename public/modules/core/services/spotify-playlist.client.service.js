'use strict';

angular.module('core').factory('SpotifyPlaylist', ['$resource',
  function($resource) {
    return $resource('spotify', {}, {
      'query': {
        method: 'GET',
        isArray: false
      }
    });
  }
]);
