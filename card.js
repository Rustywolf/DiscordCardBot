// Define exports
var exports = module.exports = function Card() {
	this.properties = {};
}

// Constants
const REGEX_STRIP = /(<(.*?)>)/g

// Private methods
function strip(value) {
	if (value == undefined) {
		return "";
	}
	
	return value.replace(REGEX_STRIP, "").trim();
}

// Public methods
exports.prototype.parse = function(key, value) {
	key = strip(key);
	value = strip(value);
	
	//console.log(key + ": " + value);
	switch(key) {
		case "English":
			this.set("name", value);
			break;
		
		case "text":
		case "Attribute":
		case "Type":
		case "Types":
		case "Level":
		case "Rank":
		case "Materials":
		case "Pendulum Scale":
		case "Property":
			if (key == "Types") {
				key = "Type";
			}
			
			this.set(key.toLowerCase(), value);
			break;
			
		// It's a monster
		case "ATK/DEF":
			vals = value.split("/");
			this.set("attack", vals[0]);
			this.set("defense", vals[1]);
			this.set("monster", "true");
			break;
	}
}

exports.prototype.set = function(key, value) {
	this.properties[key] = value;
}

exports.prototype.get = function(key) {
	return this.properties[key];
}

exports.prototype.has = function(key) {
	return this.properties[key] !== undefined;
}

exports.prototype.format = function() {
	var output = "";
	
	if (this.has("monster")) {
		// Name
		output += "**" + this.get("name") + "**\n";
		
		// Category
		output += "Category: __Monster Card__, ";
		
		// Level/Rank
		if (this.has("level")) {
			output += "Level: __" + this.get("level") + "__, ";
		} else if (this.has("rank")) {
			output += "Rank: __" + this.get("rank") + "__, ";
		}
		
		if (this.has("pendulum scale")) {
			output += "Scale: __" + this.get("pendulum scale") + "__, ";
		}
		
		// Type
		output += "Type: __" + this.get("type") + "__, ";
		
		// Attribute
		output += "Attribute: __" + this.get("attribute") + "__\n\n";
		
		// Text
		output += "*" + this.get("text") + "*\n";
		
		// Stats
		output += "ATK: __" + this.get("attack") + "__ DEF: __" + this.get("defense") + "__";
		
		return output;
	} else {
		// Name
		output += "**" + this.get("name") + "**\n";
		
		// Category
		output += "Category: __" + this.get("type") + "__, ";
		
		// Property
		output += "Property: __" + this.get("property") + "__\n\n";
		
		// Text
		output += "*" + this.get("text") + "*";
		
		return output;
	}
}