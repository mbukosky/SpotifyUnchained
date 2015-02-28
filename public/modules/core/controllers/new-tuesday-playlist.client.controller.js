'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', 'SpotifyPlaylist', 'Spotify', 'localStorageService',
  function($scope, SpotifyPlaylist, Spotify, localStorageService) {
    $scope.oneAtATime = true;
    $scope.data = SpotifyPlaylist.query();
    $scope.user = null;

    //TODO Need to figure out how to expire the token from the cache
    $scope.token = localStorageService.get('spotify-token');

    $scope.onSavePlaylist = function(title, tracks) {
      var uris = [];
      angular.forEach(tracks, function(value) {
        this.push(value.uri);
      }, uris);

      Spotify.createPlaylist($scope.user, {
        name: title,
        public: false
      }).then(function(data) {
        var playlist = data.id;

        Spotify.addPlaylistTracks($scope.user, playlist, uris).then(function(data) {
          console.log('tracks added to playlist - ' + data);
        });
      });
    };

    // $scope.token = null;
    $scope.login = function() {
      Spotify.login().then(function(data) {
        $scope.token = data;
        localStorageService.set('spotify-token', data);

        Spotify.getCurrentUser().then(function(data) {
          $scope.user = data.id;
        });
      });
    };

    if (!$scope.token) {
      $scope.login();
    } else {
      Spotify.setAuthToken($scope.token);

      Spotify.getCurrentUser().then(function(data) {
        $scope.user = data.id;
      });
    }

  }
]);