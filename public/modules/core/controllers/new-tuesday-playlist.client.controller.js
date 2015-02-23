'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', 'SpotifyPlaylist',
  function($scope, SpotifyPlaylist) {
    $scope.oneAtATime = true;
    $scope.data = SpotifyPlaylist.query();
    $scope.saved = null;

    $scope.onSavePlaylist = function(title) {
      $scope.saved = title;
    };

  }
]);