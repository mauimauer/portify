var request = require('superagent');

function GoogleMusic() {
	this.host = 'play.google.com';
	this.baseUrl = 'https://play.google.com';
	this.basePath = '/music';
	this.servicePath = this.basePath+'/services';
	this.googleAuth = undefined;
	this.xt = undefined;
	this.sjsaid = undefined;
	this.sid = undefined;
	this.auth = undefined;
};

GoogleMusic.prototype.init = function(googleAuth, cb) {
	this.googleAuth = googleAuth;
	var me = this;
	if(this.sid == undefined) {
		this.sid = googleAuth.getSID();
	}
	if(this.auth == undefined) {
		this.auth = googleAuth.getAuthId();
	}

	request
		.head(this.baseUrl+this.basePath+'/listen')
		.set('Authorization', 'GoogleLogin auth=' + this.auth)
		.set('User-Agent','Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)')
		.set('Cookie','SID='+me.sid)
		.end(function(res){
			var sjsaidCookie = res.header['set-cookie'][0];
			var xtCookie = res.header['set-cookie'][1];

			if(res.header['update-client-auth']) {
				console.log("newauth: "+ res.header['update-client-auth']);
				me.auth = res.header['update-client-auth'];
			}

			if(res.header["set-cookie"]) {
				for(var i = 0; i < res.header["set-cookie"].length; i++) {
					if(res.header['set-cookie'][i].indexOf("xt=") != -1) {
						var xtCookie = res.header['set-cookie'][i];
						me.xt = xtCookie.substring(3, xtCookie.indexOf(';'));
					}
					if(res.header['set-cookie'][i].indexOf("sjsaid=") != -1) {
						var sjsaidCookie = res.header['set-cookie'][i];
						me.sjsaid = sjsaidCookie.substring(7, sjsaidCookie.indexOf(';'));
					}
					if(res.header['set-cookie'][i].indexOf("SID=") != -1) {
						var sidCookie = res.header['set-cookie'][i];
						me.sid = sidCookie.substring(4, sidCookie.indexOf(';'));
					}
				}
			}

			if(cb)
				cb();
		});
};

GoogleMusic.prototype.getPlaylist = function(playlistId) {
	var me = this;

	var post = "";
	if(!playlistId || playlistId == 'all') {
		post='json={}';
	} else {
		post='json={"id":"'+playlistId+'"}';
	}

	request
		.post(this.baseUrl+this.servicePath+'/loadplaylist')
		.set('Authorization', 'GoogleLogin auth=' + this.auth)
		.set('User-Agent','Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)')
		.set('Cookie','SID='+this.sid+'; sjsaid='+this.sjsaid+'; xt='+this.xt)
		.type('form')
		.query({ 'u': 0, 'xt': this.xt })
		.send(post)
		.end(function(res){
			if(res.header['update-client-auth']) {
				console.log("newauth: "+ res.header['update-client-auth']);
				me.auth = res.header['update-client-auth'];
			}

			if(res.header["set-cookie"]) {
				for(var i = 0; i < res.header["set-cookie"].length; i++) {
					if(res.header['set-cookie'][i].indexOf("xt=") != -1) {
						var xtCookie = res.header['set-cookie'][i];
						me.xt = xtCookie.substring(3, xtCookie.indexOf(';'));
					}
					if(res.header['set-cookie'][i].indexOf("sjsaid=") != -1) {
						var sjsaidCookie = res.header['set-cookie'][i];
						me.sjsaid = sjsaidCookie.substring(7, sjsaidCookie.indexOf(';'));
					}
					if(res.header['set-cookie'][i].indexOf("SID=") != -1) {
						var sidCookie = res.header['set-cookie'][i];
						me.sid = sidCookie.substring(4, sidCookie.indexOf(';'));
					}
				}
			}

			/*
			console.log(me.xt);
			console.log(me.sjsaid);
			console.log("newsid: "+me.sid);

			console.log(res); */
		});
};


GoogleMusic.prototype.addToPlaylist = function(playlistId, songRefs, cb) {

	/*
	 {"playlistId":"454e49ce-eca9-491a-a3ff-74d6c5221c8e","songRefs":[{"id":"Twu4qkvuqrqbh7rdvr3ifwaeoxu","type":2}],"sessionId":"n96mkrcjpvvu"}

	 type 2 should be a song from aa, 1 being from my own locker

	 */

	request
		.post(this.baseUrl+this.servicePath+'/addtoplaylist')
		.set('Authorization', 'GoogleLogin auth=' + this.googleAuth.getAuthId())
		.set('User-Agent','Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)')
		.set('Origin', this.baseUrl)
		.set('Cookie','SID='+this.googleAuth.getSID()+'; sjsaid='+this.sjsaid+'; xt='+this.xt)
		.type('form')
		.query({ 'u': 0, 'xt': this.xt })
		.send('json={"playlistId":"'+playlistId+'","songRefs":'+JSON.stringify(songRefs)+'}')
		.end(function(res){
			// {"playlistId":"454e49ce-eca9-491a-a3ff-74d6c5221c8e","songIds":[{"playlistEntryId":"944c270a-fa78-32a0-af87-992c98158183","songId":"6a2926cb-fcf9-352e-8c0e-a1f403595748"}]}
			if(cb) {
				cb(JSON.parse(res.text));
			}
		});
};

GoogleMusic.prototype.search = function(query, cb) {
	request
		.post(this.baseUrl+this.servicePath+'/search')
		.set('Authorization', 'GoogleLogin auth=' + this.googleAuth.getAuthId())
		.set('Origin', this.baseUrl)
		.set('Cookie','SID='+this.googleAuth.getSID()+'; sjsaid='+this.sjsaid+'; xt='+this.xt)
		.set('Content-Type', 'application/json')
		.type('form')
		.query({ 'u': 0, 'xt': this.xt })
		.send('json={"q":"'+query+'"}')
		.end(function(res){
			var response = JSON.parse(res.text);

			if(cb)
				cb(response);
		});
};

GoogleMusic.prototype.search2 = function(query, cb) {
	var that = this;
	setTimeout(function innerSearch() {
		request
			.post(that.baseUrl+that.servicePath+'/search')
			.timeout(3000)
			.set('Authorization', 'GoogleLogin auth=' + that.googleAuth.getAuthId())
			.set('Origin', that.baseUrl)
			.set('Cookie','SID='+that.googleAuth.getSID()+'; sjsaid='+that.sjsaid+'; xt='+that.xt)
			.set('Content-Type', 'application/json')
			.type('form')
			.query({ 'u': 0, 'xt': that.xt, 'format': 'jsarray' })
			.send('[["'+randomString(12,'abcdefghijklmnopqrstuvwxyz0123456789')+'",1],["'+query+'",2]]')
			.end(function(err, res){
	
				if(err) {
					console.error("gmusic:search2(), error");
					console.error(err);
				}
				if (res) {
				response = res.text.replace(/(\r\n|\n|\r)/gm,"").replace(/\,\,/g, ',"",').replace(/\[\,/g, '["",').replace(/\,\]/g, ',""]').replace(/\,\,/g, ',"",');
	                        }
				try {
					var parsed = JSON.parse(response);
					if(cb)
						cb(parsed);
				} catch(e) {
					console.error("gmusic:search2(), parsing failed");
				}
			});
	}, 3000);
};

GoogleMusic.prototype.addPlaylist = function(title, cb) {
	var me = this;
	request
		.post(this.baseUrl+this.servicePath+'/addplaylist')
		.set('Authorization', 'GoogleLogin auth=' + this.googleAuth.getAuthId())
		.set('Cookie','SID='+this.sid+'; sjsaid='+this.sjsaid+'; xt='+this.xt)
		.set('Content-Type', 'application/json')
		.type('form')
		.query({ 'u': 0, 'xt': this.xt })
		.send('json={"title":"'+title+'"}')
		.end(function(res){
			var response = JSON.parse(res.text);

			if(cb)
				cb(response);
		});
};

GoogleMusic.prototype.createPlaylist = function(title, description, isPublic, cb) {
	var me = this;

	var send = "";
	if(title && description && isPublic) {
		send = '[[null,1],['+isPublic+',"'+title+'","'+description+'",[]]]'
	} else if(title && description) {
		send = '[[null,1],[false,"'+title+'","'+description+'",[]]]'
	} else {
		send = '[[null,1],[false,"'+title+'",null,[]]]'
	}

	request
		.post(this.baseUrl+this.servicePath+'/createplaylist')
		.set('Authorization', 'GoogleLogin auth=' + this.googleAuth.getAuthId())
		.set('Origin', this.baseUrl)
		.set('Cookie','SID='+this.sid+'; sjsaid='+this.sjsaid+'; xt='+this.xt)
		.set('Content-Type', 'application/json')
		.type('form')
		.query({ 'u': 0, 'xt': this.xt, 'format': 'jsarray'})
		.send(send)
		.end(function(res){
			//console.log(res);
			var response = JSON.parse(res.text);

			if(cb)
				cb({ 'id': response[1][0] });
		});
};

function randomString(len, charSet) {
	charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var randomString = '';
	for (var i = 0; i < len; i++) {
		var randomPoz = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(randomPoz,randomPoz+1);
	}
	return randomString;
}

var gmusic = new GoogleMusic();
module.exports = gmusic;
