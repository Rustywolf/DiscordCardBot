var exports = module.exports = {};

var http = require('http');

function getCardList(callback) {
	var options = {
		host: "duelingnetwork.com",
		port: 80,
		path: "/cardlist/",
	};
	
	http.get(options, function(res) {
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

var length = -1;
var lastCard = -1;

function checkList() {
	getCardList(function (body) {
		var lines = parseList(body).split("\n");
		if (lines.length > length) {
			console.log("New cards added!");
			global.bot.sendMesage(global.config.dn.channel, "New cards found! " + lines.length - length + " cards added.");
		}
	});
}

exports.onLoad = function() {
	getCardList(function (body) {
		var lines = parseList(body).split("\n");
		var line = lines[lines.length-1].trim();
		var data = line.split(" ", 2);
		if (data.length == 2) {
			var number = data[0];
			var name = data[1];
			
			lastCard = number;
			length = lines.length;
			console.log("Card list processed. Latest card: #" + lastCard);
			
			setInterval(checkList, 60000);
		} else {
			console.log("Error reading cardlist!");
			return;
		}
	});
}
