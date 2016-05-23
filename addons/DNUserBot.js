var exports = module.exports = {};

var url = require('url');
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

// https://gist.github.com/CatTail/4174511
var decodeHtmlEntity = function(str) {
  return str.replace(/&#(\d+);/g, function(match, dec) {
    return String.fromCharCode(dec);
  });
};

var regex = /<body>\n\n(.*?)\n<\/body>/gi;
function parseList(body) {
	var ret = regex.exec(body)[1];
	ret = ret.replace(/<br \/>/g, "\n");
	ret = decodeHtmlEntity(ret);
	ret = ret.replace(/^\s+|\s+$/g, "");
	
	regex.lastIndex = 0;
	return ret;
}

function fetchAdminList(callback) {
	var adminOptions = url.parse(global.config.dn.admins);
	adminOptions.port = 80;
	
	http.get(adminOptions, function(res) {
		res.setEncoding('utf8');
		
		var body = '';
		
		res.on('data', function(chunk) {
			body += chunk;
		}).on('end', function() {
			callback(parseList(body).split("\n"));
		}).on('error', function (err) {
			console.log("Error: " + err.message);
		});
	});
}

exports.onLoad = function() {
	fetchAdminList(function(admins) {
		
		login(global.config.dn.username, global.config.dn.password, function(body) {
			var response = body.split(",");
			var client = new DNUser(response[1], response[2], admins);
			console.log("Connected to DN");
			
			setInterval(function() {
				fetchAdminList(function(admins) {
					client.allAdmins = admins;
					console.log("Updated admin list!");
				});
			}, 1000*60*60*6);
			
			global.bot.on("message", function(message) {
				if (message.channel.id == global.config.dn.channel) {
					if (message.content == null || message.content == "") return;
					var args = message.content.split(" ");
					
					if (args[0] == "!online") {
						var callback = function() {
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
							msg += "**Admins Offduty:** " + client.offdutyAdmins.length;
							if (client.offdutyAdmins.length > 0) {
								msg += " (";
								client.offdutyAdmins.forEach(function(admin) {
									msg += admin + ", ";
								});
								
								msg = msg.substring(0, msg.length - 2);
								msg += ")";
							}
							
							msg += "\n";
							msg += "**Users Online:** " + client.onlineUsers;
							
							msg += "\n";
							msg += "**Calls Waiting:** " + client.calls;
							
							bot.reply(message, msg);
						}
						
						if (client.accountHandler.state == DNStates.LOGGED_IN) {
							client.onHasUsers(callback);
						} else {
							if (client.accountHandler.state == DNStates.LOGGED_OUT) {
								client.connect();
							}
							
							client.accountHandler.onLogin(function() {
								client.onHasUsers(callback);
							});
						}
						
					} else if (args[0] == "!profile" && args.length > 1) {
						var requester = message.author;
						var user = args.join(" ").substring(9).toLowerCase();
						if (user == null || user == "") return;
						
						var callback = function() {								
							client.send(["Get profile", user]);
							
							if (client.profileRequests[user] == undefined) {
								client.profileRequests[user] = [];
							}
							
							client.profileRequests[user].push(requester);
						}
						
						if (client.accountHandler.state == DNStates.LOGGED_IN) {
							callback();
						} else {
							if (client.accountHandler.state == DNStates.LOGGED_OUT) {
								client.connect();
							}
							
							client.accountHandler.onLogin(callback);
						}
					} else if (args[0] == "!history" && args.length > 1) {
						var requester = message.author;
						var user = args.join(" ").substring(9).toLowerCase();
						
						var waiting = client.waitingOnRequest;
						if (!waiting) {
							client.waitingOnRequest = true;
						}
						
						if (user == null || user == "") return;
						
						var callback = function() {			
							var sendRequest = false;
							if (!waiting) {
								sendRequest = true;
							}
							var statusRequest = client.historyRequests.find(function(request) {
								return request.username == user;
							});
							
							if (statusRequest == undefined) {
								statusRequest = {
									username: user,
									requesters: [
										requester
									]
								};
								
								client.historyRequests.push(statusRequest);
							} else {
								statusRequest.requesters.push(requester);
							}
							
							if (sendRequest) {
								client.send(["Ban status", user]);
							}
						}
						
						if (client.accountHandler.state == DNStates.LOGGED_IN) {
							callback();
						} else {
							if (client.accountHandler.state == DNStates.LOGGED_OUT) {
								client.connect();
							}
							
							client.accountHandler.onLogin(callback);
						}
					}
				}
			});
		});
	});
}

const DN_VERSION = "Connect23";

function DNUser(username, session, admins) {
	var user = this;
	
	this.username = username;
	this.session = session;
	this.clientSession = randomHex(32);
	this.client = {};
	this.heartbeat = -1;
	this.allAdmins = admins;
	
	this.profileRequests = {};
	this.historyRequests = [];
	this.waitingOnRequest = false;
	
	this.hasCalls = false;
	this.hasUsers = false;
	this.hasUsersQueue = [];
	this.onlineUsers = 0;
	this.onlineAdmins = [];
	this.offdutyAdmins = [];
	this.calls = 0;
	
	this.accountHandler = new AccountHandler();
	
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
		this.accountHandler.changeState(DNStates.LOGGING_IN);
		this.hasUsers = false;
		this.hasCalls = false;
		this.hasUsersQueue = [];
		this.onlineUsers = 0;
		this.onlineAdmins = [];
		this.offdutyAdmins = [];
		this.calls = 0;
	
		this.client = net.createConnection({
			host: "duelingnetwork.com",
			port: "1234"
		}, function() {
			user.send([DN_VERSION, user.username, user.session, user.clientSession, "Administrate"]);
			user.openHeartbeat();
			user.accountHandler.changeState(DNStates.LOGGED_IN);
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
		
		if (args.length > 0) {
			var command = args[0];
			
			switch (command) {
				case 'Online users':
					for (var i = 1; i < args.length; i += 2) {
						var name = args[i];
						var rank = args[i+1];
						
						if (name == "JoeyBot") {							
							this.onlineUsers++;
							break;
						}
						
						if (rank > 0) {
							user.onlineAdmins.push(name);
						} else if (user.allAdmins.indexOf(name) != -1) {
							user.offdutyAdmins.push(name);
						}
						
						user.onlineUsers++;
					}
					
					this.hasUsers = true;
					if (this.hasCalls) {
						this.hasUsersQueue.forEach(function(callback) {
							callback();
						});
						
						this.hasUsersQueue = [];
						
						
						this.checkRemainingRequests();
					}
								
					break;
					
				case 'Offline users':
					for (var i = 1; i < args.length; i++) {
						var name = args[i];
						
						var indexOf = user.onlineAdmins.indexOf(name);
						if (indexOf != -1) {
							user.onlineAdmins.splice(indexOf, 1);
						}
						
						var indexOfOffline = user.offdutyAdmins.indexOf(name);
						if (indexOfOffline != -1) {
							user.offdutyAdmins.splice(indexOfOffline, 1);
						}
						
						user.onlineUsers--;
					}
					
					break;
					
				case 'Add admin calls':
					this.calls = (args.length - 1) / 3;
					
					this.hasCalls = true;
					if (this.hasUsers) {
						this.hasUsersQueue.forEach(function(callback) {
							callback();
						});
						
						this.hasUsersQueue = [];
						
						
						this.checkRemainingRequests();
					}
					break;
					
				case 'Get profile':
					var profile = new UserProfile(args);
					if (user.profileRequests[profile.username.toLowerCase()] != undefined) {
						var msg = "";
						user.profileRequests[profile.username.toLowerCase()].forEach(function(requester) {
							msg += requester.mention() + ", ";
						});
						
						msg = msg.substring(0, msg.length - 2);
						msg += "\n";
						msg += "**Username:** " + profile.username + "\n";
						msg += "**Match Results:** " + profile.matchesWins + "/" + profile.matchesLoses + " (**Rating:** " + profile.matchesRating + ")\n";
						msg += "**Singles Results:** " + profile.singlesWins + "/" + profile.singlesLoses + "/" + profile.singlesDraws + " (**Rating:** " + profile.singlesRating + ")\n";
						
						var date = new Date(Date.now() - profile.dateCreated*1000);
						msg += "**Registered:** ";
						msg += ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()] + " " + date.getDate() + ", " + date.getFullYear();
						
						global.bot.sendMessage(global.config.dn.channel, msg);
						
						delete user.profileRequests[profile.username.toLowerCase()];
						
						this.checkRemainingRequests();
					}
					break;
					
				case "Ban status":
				console.log("req");
					var history = new UserHistory(args);
					var current = user.historyRequests.shift();
					if (current.username != undefined) {
						var msg = "";
						current.requesters.forEach(function(requester) {
							msg += requester.mention() + ", ";
						});
						
						msg = msg.substring(0, msg.length - 2);
						msg += "\n";
						
						msg += "**Username:** " + current.username + "\n";
						msg += "**Status:** " + history.status + "\n";
						msg += "**Strikes:** " + history.strikes + "\n";
						
						history.messages.forEach(function(message) {
							if (!message.truncated) {
								msg += " • __" + message.note + "__ *by* **" + message.admin + "** - ";
								if (message.time) {
									msg += "**" + message.time + "** - "
								}
								msg += "*" + message.date + "*\n";
							} else {
								msg += "*Results truncated past 10 entries*\n";
							}
						});
						
						global.bot.sendMessage(global.config.dn.channel, msg);
					}
					
					if (user.historyRequests.length > 0) {
						this.send(["Ban status", user.historyRequests[0].username]);
					} else {
						this.waitingOnRequest = false;
					}
						
					this.checkRemainingRequests();
					break;
			}
		}
	};
	
	this.logout = function() {
		this.accountHandler.state = DNStates.LOGGED_OUT;
		clearInterval(this.heartbeat);
		this.client.end();
	}
	
	this.checkRemainingRequests = function() {
		if (countKeys(user.profileRequests) <= 0 && this.hasUsersQueue.length <= 0 && this.historyRequests.length <= 0) {
			this.logout();
		}
	}
	
	this.onHasUsers = function(callback) {
		if (this.hasUsers && this.hasCalls) {
			callback();
		} else this.hasUsersQueue.push(callback);
	}
}

var DNStates = {
	LOGGED_OUT: "LOGGED_OUT",
	LOGGING_IN: "LOGGING_IN",
	LOGGED_IN: "LOGGED_IN"
};

function UserProfile(data) {
	this.username = data[1];
	this.avatar = data[2];
	this.online = data[3];
	this.lastOnline = data[4];
	this.dateCreated = data[5];
	this.singlesRating = data[6];
	this.matchesRating = data[7];
	this.singlesWins = data[8];
	this.matchesWins = data[9];
	this.singlesLoses = data[10];
	this.matchesLoses = data[11];
	this.singlesDraws = data[12];
	this.matchesDraws = data[13];
	this.description = data[14];
	this.inDuel = data[15];
	this.donator = data[16];
}

function UserHistory(data) {
	var history = this;
	
	this.status = data[1];
	this.strikes = data[2];
	this.messages = [];
	
	var messagesArray = data[3].split("\n");
	var regex = /(\|+?)(.*?)GMT/g;
	messagesArray.every(function(message, index) {
		if (message == "") return;
		
		var messageObj;
		regex.lastIndex = 0;
		if (!regex.test(message) || index >= 10) {
			messageObj = {
				truncated: true
			}
		} else {
			var split = message.split(/\|+?/);
			
			var date = split[1].trim();
			var time = false;
			if (date.indexOf("\\,") != -1) {
				var dateSplit = date.split("\\,");
				var date = dateSplit[0].trim();
				var time = dateSplit[1].trim();
			}
			
			var noteSplitBy = (!time) ? " by " : " - ";
			var note = split[0].trim();
			var noteSplit = note.split(noteSplitBy);
			var admin = noteSplit.pop().trim();
			var note = noteSplit.join(noteSplitBy).trim();
			
			messageObj = {
				note: note,
				admin: admin,
				date: date,
				time: time
			};
		}
		
		history.messages.push(messageObj);
		
		if (messageObj.truncated) {
			return false;
		} else {
			return true;
		}
	});
}

var AccountHandler = function() {
	this.onLoggedOut = [];
	this.onLogIn = [];
	this.state = DNStates.LOGGED_OUT;
	
	this.onLogin = function(callback) {
		this.onLogIn.push(callback);
	}
	
	this.onLogout = function(callback) {
		this.onLoggedOut.push(callback);
	}
	
	this.changeState = function(state) {
		if (this.state == state) return;
		
		this.state = state;
		if (state == DNStates.LOGGED_IN) {
			this.onLogIn.forEach(function(callback) {
				callback();
			});
			
			this.onLogIn = [];
		} else if (state == DNStates.LOGGED_OUT) {
			this.onLoggedOut.forEach(function(callback) {
				callback();
			});
			
			this.onLoggedOut = [];
		}
	}
}

function countKeys(obj) {
	var count = 0;
	for (k in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, k)) {
			count++;
		}
	}
	
	return count;
}