angular.module('portify', []).
  factory('portifyService', function($rootScope, $http, $q) {
    var portifyService = {};

    //Gets the list of nuclear weapons
    portifyService.getSpotifyPlaylists = function() {
		var deferred = $q.defer();
		$http.get('/spotify/playlists')
            .success(function(data) {
                deferred.resolve(data.data);
            })
			.error(function(error){
				$scope.error = error;
				deferred.reject();
				alert(error);
			});

        return deferred.promise;
    };

	portifyService.startTransfer = function(lists) {
		$http({
			url: "/portify/transfer/start",
			dataType: "json",
			method: "POST",
			data: lists,
			headers: {
				"Content-Type": "application/json; charset=utf-8"
			}
		}).success(function(response){
				if(response.status == 200) {
					/*$http({
					 url: "/test",
					 dataType: "json",
					 method: "GET",
					 headers: {
					 "Content-Type": "application/json; charset=utf-8"
					 }
					 }).success(function(res) {

					 });*/
					console.log("transfer initiated.");
				} else {
					alert("Login failed.");
				}
			}).error(function(error){
				console.log(error);
			});
	};

    return portifyService;
  }).
	factory('context', function($rootScope, $http, $q) {
		var items = [];
		var context = {};

		context.addItem = function(item) {
			items.push(item);
		};
		context.clear = function() {
			items = [];
		};
		context.removeItem = function(item) {
			var index = items.indexOf(item);
			items.splice(index, 1);
		};
		context.items = function() {
			return items;
		};

		return context;
	}).
	factory('socket', function ($rootScope) {
		var socket = io.connect();
		return {
			on: function (eventName, callback) {
				socket.on(eventName, function () {
					var args = arguments;
					$rootScope.$apply(function () {
						callback.apply(socket, args);
					});
				});
			},
			emit: function (eventName, data, callback) {
				socket.emit(eventName, data, function () {
					var args = arguments;
					$rootScope.$apply(function () {
						if (callback) {
							callback.apply(socket, args);
						}
					});
				})
			}
		};
	}).
  config(function($routeProvider, $locationProvider) {
	//$locationProvider.html5Mode(true);
	$routeProvider.
		  when('/', {templateUrl: '/partials/welcome.html', controller: WelcomeCtrl}).
		  when('/about', {templateUrl: '/partials/about.html', controller: AboutCtrl}).
	      when('/google/login', {templateUrl: '/partials/google_login.html', controller: GoogleLoginCtrl}).
		  when('/spotify/login', {templateUrl: '/partials/spotify_login.html', controller: SpotifyLoginCtrl}).
		  when('/spotify/playlists/select', {templateUrl: '/partials/playlists.html', controller: SelectSpotifyCtrl}).
		  when('/transfer/process', {templateUrl: '/partials/process.html', controller: ProcessTransferCtrl}).
	      otherwise({redirectTo: '/google/login'});
  }).
	animation('view-enter', function() {
		return {
			setup : function(element) {
				//prepare the element for animation
				element.css({ 'opacity': 0 });
				var memo = "..."; //this value is passed to the start function
				return memo;
			},
			start : function(element, done, memo) {
				//start the animation
				element.animate({
					'opacity' : 1
				}, 1000, function() {
					//call when the animation is complete
					done()
				});
			}
		}
	}).
	animation('view-leave', function() {
		return {
			setup : function(element) {
				//prepare the element for animation
				element.css({ 'opacity': 1 });
				var memo = "..."; //this value is passed to the start function
				return memo;
			},
			start : function(element, done, memo) {
				//start the animation
				element.animate({
					'opacity' : 0
				}, 1000, function() {
					//call when the animation is complete
					done()
				});
			}
		}
	});