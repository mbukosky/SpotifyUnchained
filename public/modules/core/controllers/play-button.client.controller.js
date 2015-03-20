'use strict';

angular.module('core').controller('PlayButtonController', ['$scope',
  function($scope) {
    $scope.loaded = false;

    $scope.done = function(track) {
      //TODO: Figure out why I need to use a apply here
      $scope.$apply(function() {
        $scope.loaded = true;
      });
    };
  }
]);
