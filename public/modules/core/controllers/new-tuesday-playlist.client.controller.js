'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', 'Spotify',
  function($scope, Spotify) {

    $scope.data = Spotify.query();

  }
]);
