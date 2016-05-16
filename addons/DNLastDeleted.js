var exports = module.exports = {};

var lastMessage = "";
var lastUser = "";

exports.onLoad = function() {
	global.bot.on('messageDeleted', function(message, channel) {
		if (channel.id == global.config.dn.channel) {
			if (message) {
				lastMessage = message.content;
				lastUser = message.author.username;
			}
		}
	});
	
	global.bot.on('message', function(message) {
		if (message.channel.id == global.config.dn.channel) {
			if (message.content == "!replay") {
				bot.reply(message, "\n**" + lastUser + "** said:\n" + lastMessage);
			}
		}
	});
}