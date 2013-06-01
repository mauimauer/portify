var app,
	express,
	router,
	server,
	postField,
	appjs = false,
	http = require('http'),
	GoogleClientLogin = require('googleclientlogin').GoogleClientLogin,
	Spotify = require('spotify-web'),
	events = require('events'),
	googleMusic = require('./gmusic.js'),
	io = require('socket.io');

if (typeof Proxy !== 'object' || typeof WeakMap !== 'function') {
	console.log("Starting without harmony");
	express = require('express');
	postField = "body";
	app = express();
	server = http.createServer(app)
	router = app;
	app.use(express.static(__dirname + '/content'));
	app.use (function(req, res, next) {
		var data='';
		req.setEncoding('utf8');
		req.on('data', function(chunk) {
			data += chunk;
		});

		req.on('end', function() {
			req.body = data;
			next();
		});
	});
	app.use(app.router);

	server.listen(3000);
	io = io.listen(server);
} else {
	io = io.listen(1983);
	postField = "post";
	app = module.exports = require('appjs');
	router = app.router;
	appjs = true;
}

var Transfer = function() {};
Transfer.prototype = new events.EventEmitter;
var transferProcess = new Transfer();

transferProcess.on('transfer', function(lists) {
	var playlistMap = {};
	var playlists = [];
	googleMusic.init(googleAuth, function() {
		console.log("initiated gmusic");
		lists.forEach(function(item) {

			googleMusic.addPlaylist(item.name, function(playlist) {
				console.log("created playlist "+ item.name + "("+item.uri+") on google music");

				playlistMap[item.uri] = playlist.id;

				io.sockets.emit('gmusic:created_playlist', playlist);

				console.log("fetch info about playlist in spotify");

				var start = 0;
				var plo = {
					spotify_uri: item.uri,
					gm_id: playlist.id,
					tracks: []
				};

				var trackBack = function(err, spotifyPlaylist) {
					if(err) {
						io.sockets.emit('spotify:error', err);
						return;
					}

					spotifyPlaylist.contents.items.forEach(function(track) {
						spotifySession.get(track.uri, function (err, trackDetail) {
							if(err) {
								io.sockets.emit('spotify:error', err);
								return;
							}

							io.sockets.emit('spotify:got_track', { gm_playlist_id: playlist.id,
								spotify_track_uri: track.uri,
								title: trackDetail.name,
								artist: trackDetail.artist[0].name,
								cover: trackDetail.album.cover[0].uri
							});

							googleMusic.search2(trackDetail.artist[0].name+" - "+trackDetail.name, function(searchResult) {
								console.log(searchResult);

								if(searchResult.length > 1 && searchResult[1][0] && searchResult[1][0][0]) {
									var gmusicMatch = searchResult[1][0][0];

									var gmusicId = gmusicMatch[0];
									var gmusicNormalisedArtist = gmusicMatch[7];
									var gmusicNormalisedAlbum = gmusicMatch[9];
									var gmusicNormalisedAlbumArtist = gmusicMatch[8];
									var gmusicNormalisedTitle = gmusicMatch[6];

									if(gmusicNormalisedTitle.indexOf('karaoke') == -1) {
										io.sockets.emit('gmusic:found_possible_matches', { found: true, spotify_uri: track.uri, gmusic_id: gmusicId});

										googleMusic.addToPlaylist(playlist.id, [ {"id":gmusicId,"type":2} ], function(res) {
											io.sockets.emit('gmusic:added', { found: false, spotify_uri: track.uri, gmusic_id: gmusicId});
										});
									} else {
										io.sockets.emit('gmusic:found_possible_matches', { found: false, spotify_uri: track.uri, karaoke: true});
									}
								} else {
									io.sockets.emit('gmusic:found_possible_matches', { found: false, spotify_uri: track.uri});
								}

							});
						});
					});

					start += spotifyPlaylist.contents.items;

					if(spotifyPlaylist.contents.truncated)
						spotifySession.playlist(item.uri, start, 20, trackBack);
				};
				spotifySession.playlist(item.uri, start, 20, trackBack);
			});
		});
	});
});

var googleAuth = undefined;
var spotifySession = undefined;

io.sockets.on('connection', function (socket) {
	socket.emit('news', { hello: 'world' });
	socket.on('my other event', function (data) {
		console.log(data);
	});
});

router.post('/google/login', function(request, response, next){
  var post = JSON.parse(request[postField]);
  googleAuth = new GoogleClientLogin({
	email: post.email,
	password: post.password,
	service: 'sj'
  });

  googleAuth.on(GoogleClientLogin.events.login, function(){
	console.log("Google Login success");
	response.send({ status: 200, message: "login successful." });
  });
  googleAuth.on(GoogleClientLogin.events.error, function(){
	console.log("Google Login failed");
	response.send({ status: 400, message: "login failed." });
  });
  googleAuth.login();
});

router.post('/spotify/login', function(request, response, next){
  var post = JSON.parse(request[postField]);
  Spotify.login(post.username, post.password, function (err, spotify) {
	if(err) {
		console.log("Spotify Login failed");
		console.log(err);
		response.send({ status: 400, message: "login failed.", error: err });
		return;
	}
	
	console.log("Spotify Login success");
	spotifySession = spotify;
	response.send({ status: 200, message: "login successful." });
  });
});

router.post('/portify/transfer/lists', function(request, response, next){

});

router.get('/portify/transfer/lists', function(request, response, next){

});

router.post('/portify/transfer/start', function(request, response, next){
	var lists = JSON.parse(request[postField]);

	transferProcess.emit('transfer', lists);
	io.sockets.emit('test', { receivers: 'everyone'});
	console.log("starting transfer...");

	response.send({ status: 200, message: "login successful." });

});


router.get('/spotify/playlists', function(request, response, next){
  if(!spotifySession) {
	  response.send({ status: 400, message: "you need to login to spotify"});
	  return;
  }
  spotifySession.rootlist(function (err, rootlist) {
    if (err) {
		console.log(err);
		response.send({ status: 400, message: "could not get spotify playlists", error: err });
		return;
	}
	console.log("got "+ rootlist.contents.items.length + " playlists");
	var playlists = [];
	var i = 0;

	rootlist.contents.items.forEach(function(item) {
		if(item.uri.indexOf('playlist') != -1) {
			spotifySession.playlist(item.uri, 0, 1, function (err, pl) {
				if (err) {
					console.log(err);
					response.send({ status: 400, message: "could not get spotify playlist "+ item.uri, error: err });
					return;
				}

				i++;
				var plist = {
					name: pl.attributes.name,
					uri: item.uri
				};
				playlists.push(plist);
				
				if(i == rootlist.contents.items.length) {
					response.send({ status: 200, message: "ok", data: playlists});
				}
			});
		} else {
			i++;
		}
	});
  });
});

if(appjs) {
	app.serveFilesFrom(__dirname + '/content');

	var menubar = app.createMenu([{
	  label:'&File',
	  submenu:[
	    {
	      label:'E&xit',
	      action: function(){
	        window.close();
	      }
	    }
	  ]
	},{
	  label:'&Window',
	  submenu:[
	    {
	      label:'Fullscreen',
	      action:function(item) {
	        window.frame.fullscreen();
	        console.log(item.label+" called.");
	      }
	    },
	    {
	      label:'Minimize',
	      action:function(){
	        window.frame.minimize();
	      }
	    },
	    {
	      label:'Maximize',
	      action:function(){
	        window.frame.maximize();
	      }
	    },{
	      label:''//separator
	    },{
	      label:'Restore',
	      action:function(){
	        window.frame.restore();
	      }
	    }
	  ]
	}]);

	menubar.on('select',function(item){
	  console.log("menu item "+item.label+" clicked");
	});

	var trayMenu = app.createMenu([{
	  label:'Show',
	  action:function(){
	    window.frame.show();
	  },
	},{
	  label:'Minimize',
	  action:function(){
	    window.frame.hide();
	  }
	},{
	  label:'Exit',
	  action:function(){
	    window.close();
	  }
	}]);

	var statusIcon = app.createStatusIcon({
	  icon:'./data/content/icons/32.png',
	  tooltip:'Portify',
	  menu:trayMenu
	});

	var window = app.createWindow({
	  width  : 800,
	  height : 600,
	  icons  : __dirname + '/content/icons'
	});

	window.on('create', function(){
	  console.log("Window Created");
	  window.frame.show();
	  window.frame.center();
	  window.frame.setMenuBar(menubar);
	});

	window.on('ready', function(){
	  console.log("Window Ready");
	  window.process = process;
	  window.module = module;

	  function F12(e){ return e.keyIdentifier === 'F12' }
	  function Command_Option_J(e){ return e.keyCode === 74 && e.metaKey && e.altKey }

	  window.addEventListener('keydown', function(e){
	    if (F12(e) || Command_Option_J(e)) {
	      window.frame.openDevTools();
	    }
	  });
	});

	window.on('close', function(){
	  console.log("Window Closed");
	});
}