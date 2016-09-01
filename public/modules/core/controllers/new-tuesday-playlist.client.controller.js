'use strict';

angular.module('core').controller('NewTuesdayPlaylistController', ['$scope', '$http', '$location', '$log', 'SpotifyPlaylist', 'Spotify', 'Authentication',
  function($scope, $http, $location, $log, SpotifyPlaylist, Spotify, Authentication) {
    $scope.oneAtATime = true;
    $scope.user = Authentication.user;
    $scope.saved = {};
    $scope.loaded = false;

    $scope.playlistsPerPage = 10;
    $scope.pagination = {
      current: 1
    };

    var getPlaylists = function(page) {
      $scope.data = SpotifyPlaylist.query({
        page: page,
        size: $scope.playlistsPerPage
      }, function() {
        $scope.loaded = true;
      });
    };

    // Always load the first page
    getPlaylists(1);

    $scope.pageChanged = function(newPage) {
      $scope.loaded = false;

      getPlaylists(newPage);
    };

    //TODO: Move this code into the view?
    $scope.getTrackTemplate = function(track) {
      if (track.preview) {
        return '/modules/core/views/track-play-button.template.html';
      } else {
        return '/modules/core/views/track-preview.template.html';
      }
    };

    $scope.preview = function(track) {
      track.preview = true;
    };

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
          $log.info(user_id + ' downloaded ' + title + ' - ' + JSON.stringify(data));
        });
      });
    };

    $scope.refreshToken = function() {
      $http.get('/auth/spotify/refresh').success(function(response) {
        // Update the user with new tokens
        $scope.user = Authentication.user = response;
        $location.path('/');
      }).error(function(response) {
        $log.error(response.message);
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
          $log.warn(error.message);

          $scope.refreshToken();
        }
      });
    }

  }
]);
