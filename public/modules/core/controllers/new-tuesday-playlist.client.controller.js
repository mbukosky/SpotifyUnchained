'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', '$http', '$location', 'SpotifyPlaylist', 'Spotify', 'localStorageService', 'Authentication',
  function($scope, $http, $location, SpotifyPlaylist, Spotify, localStorageService, Authentication) {
    $scope.oneAtATime = true;
    $scope.data = SpotifyPlaylist.query();
    $scope.authentication = Authentication;
    $scope.user = Authentication.user;

    //TODO Need to figure out how to expire the token from the cache

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

    if ($scope.user) {
      $scope.token = $scope.user.providerData.refreshToken.access_token;
      Spotify.setAuthToken($scope.token);

      Spotify.getCurrentUser().then(function(data) {
        //TODO can I just use the error promise?
      }, function(response) {
        var error = response.error;
        if (error.status == 401) {
          console.error(error.message);
          //TODO need to redirect back to signin
        }
      });
    }

  }
]);