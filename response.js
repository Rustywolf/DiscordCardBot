var exports = module.exports = function Response(send, count) {
	this.send = send;
	
	this.cardCount = count;
	this.processed = 0;
	this.message = "";
}

exports.prototype.handle = function(card) {
	this.processed++;
	this.message += card.format() + "\n\n";
	if (this.processed == this.cardCount) {
		this.send(this.message.trim());
	}
}