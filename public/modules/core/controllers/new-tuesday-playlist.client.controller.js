'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', '$http', '$location', 'SpotifyPlaylist', 'Spotify', 'Authentication',
  function($scope, $http, $location, SpotifyPlaylist, Spotify, Authentication) {
    $scope.oneAtATime = true;
    $scope.data = SpotifyPlaylist.query();
    $scope.user = Authentication.user;
    $scope.saved = {};

    var determineSavedPlaylists = function() {
      /* Get the first 50 playlist and see if the user has
       * already downloaded it. Use the playlist
       * name as the matching key.
       */
      Spotify.getUserPlaylists($scope.user.username, {
        limit: 50
      }).then(function(data) {
        angular.forEach(data.items, function(value) {
          this[value.name] = true;
        }, $scope.saved);
      });
    };

    $scope.onSavePlaylist = function(title, tracks, e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if ($scope.saved[title]) {
        //TODO: Disable click
        return;
      }

      //Mark the current playlist as saved to avoid a double click
      $scope.saved[title] = true;

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
        });
      });
    };

    $scope.refreshToken = function() {
      $http.get('/auth/spotify/refresh').success(function(response) {
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

        determineSavedPlaylists();
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
