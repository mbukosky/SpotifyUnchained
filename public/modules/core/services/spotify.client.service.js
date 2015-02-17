'use strict';

angular.module('core').factory('Spotify', ['$resource',
	function($resource) {
		return $resource('spotify', {});
	}
]);
