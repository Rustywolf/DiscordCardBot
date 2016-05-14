// Imports
var database = require('./database.js');
var fs = require('fs');

// 'Class' imports
var Discord = require('discord.js');
var Response = require('./response.js')

// Constants
const MESSAGE_REGEX = /{(.*?)}/g

// Main
var config = global.config = {};
var addons = global.addons = {};
var bot = global.bot = {};

fs.readFile("./config.json", "utf8", function(err, data) {
	if (err) {
		console.log(err.message);
		return;
	}
	
	config = global.config = JSON.parse(data);
	
	bot = global.bot = new Discord.Client({
		autoReconnect: true
	});

	bot.on("message", function(message) {
		if (!config.allow_pm && !message.channel.server) {
			if (config.debug) {
				console.log("Received PM, ignoring...");
			}
			
			return;
		}
		
		if (config.server_limits && message.channel.server) {
			var serverId = message.channel.server.id;
			var channelId = message.channel.id
			if (serverId in config.server_limits) {
				var channels = config.server_limits[serverId];
				if (channels.indexOf(channelId) == -1) {
					if (config.debug) {
						console.log("Receieved messge channel #" + channelId + ", ignoring...");
					}
					return;
				}
			}
		}
		
		var result = "";
		var results = [];
		
		while ((result = MESSAGE_REGEX.exec(message.content))) {
			results.push(result);
		}
		
		if (results.length > config.card_limit_per_message) {
			bot.reply(message, "Nyeh? are ya tryin' to kill me? (" + config.card_limit_per_message + " cards per message)");
			return;
		}
		
		var searches = [];
		var response = new Response(function(text) {
			bot.reply(message, text);
		}, results.length);
		
		results.forEach(function(val) {
			var cardName = val[1];
			if (searches.indexOf(cardName) != -1) {
				return;
			}
			
			searches.push(cardName);
		
			console.log("Processing: " + cardName);
			database.lookup(cardName, function(card) {
				response.handle(card);
			});
		});
	});
	
	if (config.addons && config.addons.length > 0) {
		var addonsArray = [];
		config.addons.forEach(function(addon) { 
			var addonObj = require("./addons/" + addon + ".js");
			addons[addon] = addonObj;
			addonsArray.push(addonObj);
		});
		
		addonsArray.forEach(function(addon) {
			if (typeof addon.onLoad == "function") {
				addon.onLoad();
			}
		});
	}

	if (config.login.token) {
		bot.loginWithToken(config.login.token);
	} else {
		bot.login(config.login.email, config.login.password);
	}
});