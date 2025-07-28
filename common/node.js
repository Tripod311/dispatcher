const Event = require("./event.js");
const Address = require("./address.js");
const Log = require("../utils/log.js");

class Node {
	constructor () {
		this.dispatcher = null;
		this.address = null;
		this.subNodes = Object.create(null);
		this.requestCounter = 0;
		this.chained = Object.create(null);
		this.listeners = Object.create(null);
	}

	attach (dispatcher, address) {
		this.dispatcher = dispatcher;
		this.address = address;
	}

	detach () {
		this.hadAddress = this.address.clone();
		this.listeners = Object.create(null);
		this.dispatcher = null;
		this.address = null;
		for (let i in this.subNodes) {
			this.subNodes[i].detach();
		}
	}

	dispatch (address, hopIndex, event) {
		if (hopIndex === address.data.length) {
			if (event.trace) {
				Log.info(`EVENT TRACE: ${event.data.command} HANDLING AT [${address.data.join(',')}]`, 4);
			}
			this.handle(event);
		} else {
			let id = address.data[hopIndex];

			if (this.subNodes[id]) {
				if (event.trace) {
					Log.info(`EVENT TRACE: ${event.data.command} PASSING AT [${address.data.slice(0,hopIndex).join(',')}]`, 4);
				}
				this.subNodes[id].dispatch(address, hopIndex + 1, event);
			} else {
				if (event.trace) {
					Log.info(`EVENT TRACE: ${event.data.command} STUCK AT [${address.data.slice(0,hopIndex).join(',')}]`, 4);
				}
				this.destinationUnreached(event);
			}
		}
	}

	destinationUnreached (event) {
		if (event.isResponse) {
			Log.warning("Node " + event.destination.print() + " is not present", 2);
		} else {
			event.response({
				command: event.data.command + "Response",
				error: true,
				details: "Node " + event.destination.print() + " is not present",
				reqId: event.reqId
			});
		}
	}

	handle (event) {
		if (event.data.reqId !== undefined && this.chained[event.data.reqId] !== undefined && this.chained[event.data.reqId].destination.equals(event.sender)) {
			this.chained[event.data.reqId].callback(event);
			delete this.chained[event.data.reqId];
		} else {
			if (this.listeners[event.data.command]) {
				this.listeners[event.data.command](event);
			} else {
				this.defaultHandler(event);
			}
		}
	}

	addChild (id, n) {
		let address = this.address.clone();
		address.data.push(id);
		if (this.subNodes[id]) {
			Log.warning(this.address.print() + " :: Node " + id + " already exists", 2);
		} else {
			this.subNodes[id] = n;
			n.attach(this.dispatcher, address);
		}
	}

	delChild (id) {
		if (this.subNodes[id] === undefined) {
			Log.warning(this.address.print() + " :: Node " + id + " doesn't exist", 2);
		} else {
			this.subNodes[id].detach();
			delete this.subNodes[id];
		}
	}

	getChild (id) {
		return this.subNodes[id] || null;
	}

	send (destination, data, trace) {
		let ev = new Event(this.dispatcher, this.address, (destination instanceof Address) ? destination : new Address(destination), data, false, trace);
		ev.dispatch();
	}

	chain (destination, data, callback, trace) {
		let id = this.requestCounter++;
		if (id === Number.MAX_SAFE_INTEGER) {
			this.requestCounter = 0;
		}
		this.chained[id] = {
			callback: callback,
			destination: new Address(destination)
		}
		data.reqId = id;
		this.send(destination, data, trace);
		return id;
	}

	clearChain (id) {
		delete this.chained[id];
	}

	clearChainByDestination (destination) {
		for (let i in this.chained) {
			if (this.chained[i].destination.equals(destination)) {
				this.clearChain(i);
			}
		}
	}

	setListener (command, fn) {
		this.listeners[command] = fn;
	}

	removeListener (command) {
		delete this.listeners[command];
	}

	defaultHandler (event) {
		if (this.address) {
			Log.warning(this.address.print() + " :: DEFAULT HANDLER - \n" + JSON.stringify(event.data), 2);
		} else {
			Log.warning("Node already detached\n" + JSON.stringify({
				sender: event.sender.print(),
				destination: event.destination.print(),
				data: event.data
			}), 2);
		}
	}

	get parentAddress () {
		let result = this.address.data.slice(0, this.address.data.length-1);
		return new Address(result);
	}
}

module.exports = Node;