'use strict';

angular.module('core').filter('trustPlayButton', ['$sce',
	function($sce) {
		return function(uri) {
			return $sce.trustAsResourceUrl('https://embed.spotify.com/?uri=' + uri);
		};
	}
]);
