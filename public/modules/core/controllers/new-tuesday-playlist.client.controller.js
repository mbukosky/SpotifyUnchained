'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', '$http', '$location', 'SpotifyPlaylist', 'Spotify', 'Authentication',
  function($scope, $http, $location, SpotifyPlaylist, Spotify, Authentication) {
    $scope.oneAtATime = true;
    $scope.data = SpotifyPlaylist.query();
    $scope.user = Authentication.user;

    // Saved items are using the same index as the playlist
    $scope.saved = [];
    SpotifyPlaylist.query().$promise.then(function(data) {
      angular.forEach(data, function(value) {
        this.push(false);
      }, $scope.saved);
    });

    $scope.onSavePlaylist = function(title, tracks, e, idx) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if($scope.saved[idx]){
        //TODO: Disable click
        return;
      }

      var uris = [];
      angular.forEach(tracks, function(value) {
        this.push(value.uri);
      }, uris);

      var user_id = $scope.user.username;
      Spotify.createPlaylist(user_id, {
        name: title,
        public: false
      }).then(function(data) {
        var playlist = data.id;

        Spotify.addPlaylistTracks(user_id, playlist, uris).then(function(data) {
          console.log('tracks added to playlist - ' + JSON.stringify(data));
          $scope.saved[idx] = true;
        });
      });
    };

    $scope.refreshToken = function() {
      $http.get('/auth/spotify/refresh', {
        params: {
          refresh_token: $scope.user.providerData.refreshToken
        }
      }).success(function(response) {
        // Update the user with new tokens
        $scope.user = Authentication.user = response;
        $location.path('/');
      }).error(function(response) {
        console.log(response.message);
      });
    };

    if ($scope.user) {
      var token = $scope.user.providerData.accessToken;
      Spotify.setAuthToken(token);

      // Try getting the users settings
      Spotify.getCurrentUser().then(function(data) {
        //TODO can I just use the error promise?
      }, function(response) {
        var error = response.error;
        if (error.status === 401) {
          console.error(error.message);

          $scope.refreshToken();
        }
      });
    }

  }
]);
