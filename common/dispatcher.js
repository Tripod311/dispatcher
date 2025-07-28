const Address = require("../common/address.js");

const PendingTimeout = 10000;

class Dispatcher {
	constructor () {
		this.root = null;
		this.lock = null;
		this.route = null;
		
		this.noop = this.loop.bind(this);
	}

	setRoot (root, address) {
		this.root = root;
		this.root.attach(this, address || new Address(["root"]));
		this.lock = setTimeout(this.noop, PendingTimeout);
	}

	getRoot () {
		return this.root;
	}

	removeRoot () {
		if (this.root) {
			this.root.detach();
			this.root = null;
		}
		clearTimeout(this.lock);
		this.lock = null;
	}

	dispatch (destination, event, hop) {
		if (this.route) {
			this.route(event);
		} else {
			this.root.dispatch(destination, hop || 1, event);
		}
	}

	loop () {
		this.lock = setTimeout(this.noop, PendingTimeout);
	}

	setRoute (route) {
		this.route = route;
	}
}

module.exports = Dispatcher;