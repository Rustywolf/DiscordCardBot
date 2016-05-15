var exports = module.exports = {};

var net = require('net');
var http = require('http');

function randomHex(length) {
	var ret = "";
    var hex = "abcdef0123456789";
    for (var i = 0; i < length; i++)
        ret += hex.charAt(Math.floor(Math.random() * hex.length));
    return ret;
}

function login(username, password, callback) {
	var query = "username=" + username + "&password=" + password + "&remember_me=false&dn_id=cafebabecafebabecafebabecafebabe";
                    
	var options = {
		host: "duel.duelingnetwork.com",
		port: 8080,
		path: "/Dueling_Network/login.do",
		method: "POST",
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(query)
		}
	};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		
		var body = '';
		
		res.on('data', function(chunk) {
			body += chunk;
		}).on('end', function() {
			callback(body);
		}).on('error', function (err) {
			console.log("Error: " + err.message);
		});
	});
	
	req.on("error", function(err) {
		console.log("Error: " + err.message);
	});
	
	req.write(query);
	req.end();
}

exports.onLoad = function() {
	login(global.config.dn.username, global.config.dn.password, function(body) {
		var response = body.split(",");
		var client = new DNUser(response[1], response[2]);
		global.bot.on("message", function(message) {
			if (message.channel.id == global.config.dn.channel) {
				if (message.content == "!online") {
					var msg = "\n**Admins Online:** " + client.onlineAdmins.length;
					if (client.onlineAdmins.length > 0) {
						msg += " (";
						client.onlineAdmins.forEach(function(admin) {
							msg += admin + ", ";
						});
						
						msg = msg.substring(0, msg.length - 2);
						msg += ")";
					}
					
					msg += "\n";
					msg += "**Users Online:** " + client.onlineUsers;
					
					bot.reply(message, msg);
				}
			}
		});
	});
}

const DN_VERSION = "Connect23";

function DNUser(username, session) {
	var user = this;
	
	this.username = username;
	this.session = session;
	this.clientSession = randomHex(32);
	this.client = {};
	this.heartbeat = -1;
	
	this.onlineUsers = 0;
	this.onlineAdmins = [];
	
	this.send = function(args) {
		var string = args.join(",");
		this.client.write(string + "\0");
	}
	
	this.openHeartbeat = function() {
		this.heartbeat = setInterval(function() {
			user.send(["Heartbeat"]);
		}, 25000);
	}
	
	this.connect = function() {	
		this.onlineUsers = 0;
		this.onlineAdmins = [];
	
		this.client = net.createConnection({
			host: "duelingnetwork.com",
			port: "1234"
		}, function() {
			user.send([DN_VERSION, user.username, user.session, user.clientSession]);
			user.openHeartbeat();
		});
		
		this.buffer = "";
		this.client.on('data', function(data) {
			this.buffer += data;
			
			if (this.buffer.indexOf("\0" != -1)) {
				var messages = this.buffer.split("\0");
				for (var i = 0; i < messages.length - 1; i++) {
					user.handle(messages[i]);
				}
				
				this.buffer = messages[messages.length - 1];
			}
		});
		
		this.client.on('end', function() {
			console.log("Disconnected from DN");
		});
		
		this.client.on('error', function(err) {
			console.log("Socket Error: " + err.message);
		});
		
		this.client.on('close', function() {
			clearInterval(user.heartbeat);
			user.connect();
		});
	}
	
	function splitArgs(message) {
		var results = [];
		var string = "";
		var escaped = false;
		
		for (var i = 0; i < message.length; i++) {
			var charAt = message.charAt(i);
			if (charAt == ",") {
				if (escaped) {
					string += "\\,";
					escaped = false;
				} else {
					results.push(string);
					string = "";
				}
			} else if (charAt == "\\") {
				if (escaped) {
					string += "\\\\";
					escaped = false;
				} else {
					escaped = true;
				}
			} else {
				string += charAt;
			}
		}
		
		results.push(string);
		return results;
	}

	this.handle = function(message) {
		var args = splitArgs(message);
		
		if (args.length > 1) {
			var command = args[0];
			
			switch (command) {
				case 'Online users':
					for (var i = 1; i < args.length; i += 2) {
						var name = args[i];
						var rank = args[i+1];
						
						if (rank > 0) {
							user.onlineAdmins.push(name);
						}
						
						this.onlineUsers++;
					}
					
					break;
					
				case 'Offline users':
					for (var i = 1; i < args.length; i++) {
						var name = args[i];
						
						var indexOf = user.onlineAdmins.indexOf(name);
						if (indexOf != -1) {
							user.onlineAdmins.splice(indexOf, 1);
						}
						
						this.onlineUsers--;
					}
					
					break;
			}
		}
	};
	
	this.logout = function() {
		clearInterval(this.heartbeat);
		this.client.close();
	}
	
	this.connect();
}