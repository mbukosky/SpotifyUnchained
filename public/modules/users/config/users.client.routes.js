'use strict';

// Setting up route
angular.module('users').config(['$stateProvider',
  function($stateProvider) {
    // Users state routing
    $stateProvider.
    state('signin', {
      url: '/signin',
      templateUrl: 'modules/users/views/authentication/signin.client.view.html'
    });
  }
]);