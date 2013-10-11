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
	io = require('socket.io'),
	TimeQueue = require('timequeue');

console.log("portify 0.51");
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

	server.listen(3132);
	io = io.listen(server);
	io.set('log level', 1);
} else {
	console.log("Starting with harmony");
	postField = "post";
	app = module.exports = require('appjs');
	router = app.router;
	io = io.listen(3132);
	io.set('log level', 1);
	appjs = true;
}

//console.log=function(){};

function wait(delay) {
	return {
		then: function (callback) {
			setTimeout(callback, delay);
		}
	};
}

function getRandomInt (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

var Transfer = function() {

};
Transfer.prototype = new events.EventEmitter;
var transferProcess = new Transfer();
transferProcess.tracksDone = 0;
transferProcess.listsDone = 0;
transferProcess.playlistLength = 0;
transferProcess.list = [];

transferProcess.on('transfer', function(list) {
	var playlistMap = {};
	var playlists = [];

	if(!googleMusic || !spotifySession)
		return;

	this.list = list;
	var me = this;
	this.listsDone = 0;
	this.tracksDone = 0;
	this.playlistLength = 0;
	googleMusic.init(googleAuth, function() {
		console.log("initiated gmusic");

		transferPlaylist(me.list[0]);
	});
});
transferProcess.on('gotPlaylistLength', function(playlistLength) {
	console.log("gotPlaylistLength()");
	io.sockets.emit('portify', { type: 'playlist_length', data: { length: playlistLength }});
	this.playlistLength = playlistLength;
});
transferProcess.on('trackDone', function(track) {
	this.tracksDone++;
	console.log("trackDone() "+ this.tracksDone+"/"+this.playlistLength);
	if(this.tracksDone == this.playlistLength) {
		this.emit("playlistDone");
	} else if(this.tracksDone > this.playlistLength) {
		console.log("surplus item");
		console.log(track)
	}
});
transferProcess.on('playlistDone', function() {
	console.log("playlistDone()");
	io.sockets.emit('portify', { type: 'playlist_done', data: { playlist: this.list[this.listsDone] }});
	this.listsDone++;
	if(this.listsDone < this.list.length) {
		var me = this;
		setTimeout(function() {
			transferPlaylist(me.list[me.listsDone]);
		}, 2000)
	} else {
		this.emit('allDone');
		io.sockets.emit('portify', { type: 'all_done' });
	}
});

transferProcess.on('allDone', function() {
	console.log("allDone()");
});

var transferPlaylist = function(item) {
	transferProcess.tracksDone = 0;
	transferProcess.playlistLength = 0;

	io.sockets.emit('portify', { type: 'playlist_started', data: { playlist: item }});
	googleMusic.createPlaylist(item.name, null, false, function(playlist) {
		console.log("created playlist "+ item.name + "("+item.uri+") on google music");

		io.sockets.emit('gmusic', { type: 'playlist', data: { pl: playlist, name: item.name }});

		console.log("fetch info about playlist in spotify");

		spotifySession.playlist(item.uri, 0, 100, processSpotifyPlaylist.bind(this, item.uri, playlist, 0));
	});
}

var trackQueue = new TimeQueue(trackWorker, { concurrency: 5, every: 1000 });

function trackWorker(track, gmPlaylist, callback) {
	processTracks(gmPlaylist, track);
	callback();
}

var searchQueue = new TimeQueue(searchWorker, { concurrency: 5, every: 1000 });

function searchWorker(track, playlist, callback) {
	googleMusic.search2(track.artist[0].name+" - "+track.name,
		function(res) {
			callback();
			processGmSearchResult(track, playlist, res);
		});
}

/*function playlistWorker(arg1, arg2, callback) {
	someAsyncFunction(calculation(arg1, arg2), callback);
} */

var processSpotifyPlaylist = function(playlistId, gmPlaylist, start, err, spotifyPlaylist) {
	if(err) {
		io.sockets.emit('spotify', { type: 'error', data: err });
		console.log("spotify error: "+err);
		return;
	}

	transferProcess.emit('gotPlaylistLength', spotifyPlaylist.length);

	trackQueue.push(spotifyPlaylist.contents.items, gmPlaylist);

	start += spotifyPlaylist.contents.items.length;

	if(spotifyPlaylist.contents.truncated)
		spotifySession.playlist(playlistId, start, 100, processSpotifyPlaylist.bind(this, playlistId, gmPlaylist, start));
};

var processTracks = function(playlist, tracks) {

	var toget = [];
	for(var i = 0; i < tracks.length; i++) {
		toget.push(tracks[i].uri);
	}

	spotifySession.get(toget, function (err, tracks) {
		if(err) {
			io.sockets.emit('spotify', { type: 'error', data: err });
			console.log("spotify error: "+err);
			return;
		}

		for(var i = 0; i < tracks.length; i++) {
			var trackDetail = tracks[i];
			var cover = "/img/no_album.png";

			if(trackDetail.album.cover && trackDetail.album.cover.length >= 2 && trackDetail.album.cover[2] != undefined)
				cover = trackDetail.album.cover[2].uri;

			io.sockets.emit('spotify', { type: 'track', data: { gm_playlist_id: playlist.id,
				spotify_track_uri: trackDetail.uri,
				title: trackDetail.name,
				artist: trackDetail.artist[0].name,
				cover: cover
			}});

			searchQueue.push(trackDetail, playlist);
			//googleMusic.search2(trackDetail.artist[0].name+" - "+trackDetail.name, processGmSearchResult.bind(this, trackDetail, playlist));
		}
	});
};

var processGmSearchResult = function(track, playlist, searchResult) {
	if(searchResult.length > 1 && searchResult[1][0] && searchResult[1][0][0]) {
		var gmusicMatch = searchResult[1][0][0];

		var gmusicId = gmusicMatch[0];
		var gmusicNormalisedArtist = gmusicMatch[7];
		var gmusicNormalisedAlbum = gmusicMatch[9];
		var gmusicNormalisedAlbumArtist = gmusicMatch[8];
		var gmusicNormalisedTitle = gmusicMatch[6];

		if(gmusicNormalisedTitle.indexOf('karaoke') == -1) {
			//io.sockets.emit('gmusic', { type: 'found_possible_matches', data: { found: true, gm_playlist_id: playlist.id, spotify_uri: track.uri, gm_id: gmusicId }});

			googleMusic.addToPlaylist(playlist.id, [ {"id":gmusicId,"type":2} ], function( track, playlist, gmusicId, res) {
				io.sockets.emit('gmusic', { type: 'added', data: { found: false, spotify_uri: track.uri, gm_playlist_id: playlist.id, gm_id: gmusicId }});
				transferProcess.emit("trackDone", track.uri );
			}.bind(this, track,playlist,gmusicId));

		} else {
			//io.sockets.emit('gmusic', { type: 'found_possible_matches', data: { found: false, spotify_uri: track.uri, karaoke: true }});
			io.sockets.emit('gmusic', { type: 'not_added', data: { found: false, spotify_uri: track.uri, karaoke: true, track: track }});
			transferProcess.emit("trackDone", track.uri );
		}
	} else {
		//io.sockets.emit('gmusic', { type: 'found_possible_matches', data: { found: false, gm_playlist_id: playlist.id, spotify_uri: track.uri }});
		io.sockets.emit('gmusic', { type: 'not_added', data: { found: false, gm_playlist_id: playlist.id, spotify_uri: track.uri, track: track  }});
		transferProcess.emit("trackDone", track.uri );
	}
}

var googleAuth = undefined;
var spotifySession = undefined;

io.sockets.on('connection', function (socket) {
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

router.post('/portify/transfer/start', function(request, response, next){
	var lists = JSON.parse(request[postField]);

	if(!googleAuth) {
		response.send({ status: 401, message: "Google: not logged in." });
	}

	if(!spotifySession) {
		response.send({ status: 402, message: "Spotify: not logged in." });
	}

	if(!lists || lists.length == 0) {
		response.send({ status: 403, message: "Please select at least one playlist." });
	}

	transferProcess.emit('transfer', lists);
	console.log("starting transfer...");

	response.send({ status: 200, message: "transfer will start." });

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

	playlists.push({
		name: "Starred Tracks",
		uri: "hm://playlist/user/"+spotifySession.username+"/starred"
	});
	rootlist.contents.items.forEach(function(item) {
		if(item.uri.indexOf('playlist') != -1) {
			spotifySession.playlist(item.uri, 0, 1, function (err, pl) {
				if (err) {
					console.log(err);
					i++;
				} else {
					i++;
					var plist = {
						name: pl.attributes.name,
						uri: item.uri
					};
					playlists.push(plist);
				}
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
	  }
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
	  icons  : __dirname + '/content/icons',
      resizable: false,
	  disableSecurity: true
	});

	window.on('create', function(){
	  console.log("Window Created");
	  window.frame.show();
	  window.frame.center();
	  window.frame.setMenuBar(menubar);
	});

	window.on('keydown', function(e){
		if (e.keyIdentifier === 'F12') {
			window.frame.openDevTools();
		}
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