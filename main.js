// Imports
var database = require('./database.js');
var fs = require('fs');

// 'Class' imports
var Discord = require("discord.js");

// Constants
const MESSAGE_REGEX = /{(.*?)}/g
const SERVER_LIMITS = {
	"87400833968254976": [
		"176709073566302208",
	],
}

var config = {};

// Main
fs.readFile("./config.json", "utf8", function(err, data) {
	if (err) {
		console.log(err.message);
		return;
	}
	
	config = JSON.parse(data);

	var bot = new Discord.Client();

	bot.on("message", function(message) {
		var serverId = message.channel.server.id;
		var channelId = message.channel.id
		if (serverId in SERVER_LIMITS) {
			var channels = SERVER_LIMITS[serverId];
			if (channels.indexOf(channelId) == -1) {
				return;
			}
		}
		
		var result = "";
		var results = [];
		
		while ((result = MESSAGE_REGEX.exec(message.content))) {
			results.push(result);
		}
		
		results.forEach(function(val) {
			var cardName = val[1];
			console.log("Processing: " + cardName);
			database.lookup(cardName, function(card) {
				bot.reply(message, card.format());
			});
		});
	});

	bot.login(config.login.email, config.login.password);
});