// Imports
var http = require('http');
var difflib = require('difflib');
var jsdom = require('jsdom');

// 'Class' Imports 
var Card = require('./card.js');

// Define Export
var exports = module.exports = {};

// Constants
const URL = "yugioh.wikia.com";
const SEARCH = "/api/v1/Search/List?query=";
const SEARCH_LIMIT = "&limit=";

const IGNORE_REGEX = /(\((.*?)\)|^Card (.*?):|List of)/i

const MATCH_RATIO = 0.8;

// Private methods
function request(path, callback) {
	var options = {
		host: URL,
		port: 80,
		path: path,
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

function search(name, limit, callback) {
	request(SEARCH + encodeURIComponent(name) + SEARCH_LIMIT + encodeURIComponent(limit), function(res) {
		var data = JSON.parse(res);
		var sequenceMatcher = new difflib.SequenceMatcher(null, "", "");
		sequenceMatcher.setSeq2(name.toLowerCase());
		
		if(!data.items) {
			return;
		}
		
		data.items.some(function(item) {
			if(IGNORE_REGEX.test(item.title)) {
				if (global.config.debug) {
					console.log("Failed test: " + name + " --> " + item.title);
				}
				
				return false;
			}
			
			sequenceMatcher.setSeq1(item.title.toLowerCase());
			if (sequenceMatcher.ratio() < MATCH_RATIO) {
				if (global.config.debug) {
					console.log("Failed match: " + name + " --> " + item.title);
				}
				
				return false;
			}
			
			callback(item);
			return true;
		});
	});
}

function parseCardData(url, callback) {
	var card = new Card();
	
	jsdom.env(
		url,
		['http://code.jquery.com/jquery.js'],
		
		function(err, window) {
			if (err) {
				console.log(err.message);
				return;
			}
			
			var $ = window.$;
			var table = $('.cardtable');
			
			if (!table.length) {
				if (global.config.debug) {
					console.log("No cardtable found for page: " + url);
				}
				
				return;
			}
			
			table.find('.cardtablerow').each(function() {
				var row = $(this);
				card.parse(row.find('.cardtablerowheader').html(), row.find('.cardtablerowdata').html());
			});
			
			card.parse("text", table.find('.navbox-list').first().html().replace("<br>", "\n").trim());
			card.set("image", table.find('.cardtable-cardimage').find('img').attr('src'));
			
			callback(card);
		}
	);
	
}

// Public methods
exports.lookup = function (name, callback) {
	search(name, 5, function(data) {
		parseCardData(data.url, callback);
	});
}