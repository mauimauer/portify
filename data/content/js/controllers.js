function MainCtrl($scope, $route, $routeParams, $location, context) {
	$scope.context = context.items();
	$scope.app_name = "Portify";
	$scope.app_version = "0.0.1";

}

function WelcomeCtrl($scope, $rootScope, $route, $routeParams, $location) {
	$rootScope.step = 0;
}

function AboutCtrl($scope, $route, $routeParams, $location) {

}

function ProcessTransferCtrl($scope, $rootScope, $http, $route, $routeParams, $location, socket, context, portifyService) {
	$rootScope.step = 4;
	$scope.playlists = context.items();

	portifyService.startTransfer($scope.playlists);

	socket.on('test', function (data) {
		console.log(data);
	});
}

function GoogleLoginCtrl($scope, $rootScope, $http, $location) {
	$rootScope.step = 1;
	$scope.googleLogin = function() {
		$http({
			url: "/google/login",
			dataType: "json",
			method: "POST",
			data: $scope.loginData,
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
				$location.path( "/spotify/login" );
			} else {
				alert("Login failed.");
			}
		}).error(function(error){
			$scope.error = error;
		});
	};
}

function SpotifyLoginCtrl($scope, $rootScope, $http, $location) {
	$rootScope.step = 2;
	$scope.spotifyLogin = function() {
		$http({
			url: "/spotify/login",
			dataType: "json",
			method: "POST",
			data: $scope.loginData,
			headers: {
				"Content-Type": "application/json; charset=utf-8"
			}
		}).success(function(response){
			if(response.status == 200) {
				$location.path( "/spotify/playlists/select" );
			} else {
				alert("Login failed.");
			}
		}).error(function(error){
			$scope.error = error;
		});
	};
}

function SelectSpotifyCtrl($scope, $rootScope, $http, $location, portifyService, context) {
	$scope.playlists = portifyService.getSpotifyPlaylists();
	$rootScope.step = 3;
	$scope.selectAll = function ($event){
		var checkbox = $event.target;
		for ( var i = 0; i < $scope.playlists.$$v.length; i++) {
			$scope.playlists.$$v[i].transfer = checkbox.checked;
		}
	};

	$scope.startTransfer = function() {
		context.clear();
		for ( var i = 0; i < $scope.playlists.$$v.length; i++) {
			if($scope.playlists.$$v[i].transfer) {
				context.addItem($scope.playlists.$$v[i]);
			}
		}
		$location.path( "/transfer/process" );
	}
}