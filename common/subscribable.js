const Node = require("./node.js");

class Subscribable extends Node {
	attach (dispatcher, address) {
		super.attach.call(this, dispatcher, address);

		this.subscribers = Object.create(null);
		this.setListener("subscribe", this.subscribe.bind(this));
		this.setListener("unsubscribe", this.unsubscribe.bind(this));
	}

	subscribe (event) {
		let sId = event.sender.toString();

		if (this.subscribers[sId] === undefined) {
			this.subscribers[sId] = event.sender;
			return true;
		} else {
			return false;
		}
	}

	unsubscribe (event) {
		let sId = event.sender.toString();

		if (this.subscribers[sId] !== undefined) {
			delete this.subscribers[sId];
			return true;
		} else {
			return false;
		}
	}

	notify (data, except) {
		for (let i in this.subscribers) {
			if (i === except) continue;
			let addr = this.subscribers[i];

			this.send(addr.data, data);
		}
	}
}

module.exports = Subscribable;