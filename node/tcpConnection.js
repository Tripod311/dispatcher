const Node = require("../common/node.js");
const Event = require("../common/event.js");
const Address = require("../common/address.js");
const JSONStreamProcessor = require("../utils/jsonStreamProcessor.js");
const Log = require("../utils/log.js");

class TCPConnection extends Node {
	constructor (id, socket, pingOptions) {
		super ();

		this.id = id;
		this.socket = socket;
		this.pingOptions = pingOptions;

		this.proxy = {
			message: this.onMessage.bind(this),
			error: this.onError.bind(this),
			close: this.onClose.bind(this)
		};

		this.pingInterval = null;
		this.pingCounter = 0;
	}

	attach (dispatcher, address) {
		super.attach.call(this, dispatcher, address);

		this.processor = new JSONStreamProcessor(this.socket);
		this.processor.on("message", this.proxy.message);
		this.socket.on("error", this.proxy.error);
		this.socket.on("close", this.proxy.close);

		this.pingInterval = setInterval(this.pingSocket.bind(this), this.pingOptions.interval);

		this.socket.write(JSON.stringify({
			sender: [],
			destination: [],
			data: {
				command: "register",
				address: this.address.data
			}
		}));
	}

	detach () {
		this.processor.destructor();
		clearInterval(this.pingInterval);
		this.socket.end();
		this.socket.destroy();

		super.detach.call(this);
	}

	dispatch (address, hopIndex, event) {
		this.socket.write(JSON.stringify({
			sender: event.sender.data,
			destination: event.destination.data,
			data: event.data,
			isResponse: event.isResponse,
			trace: event.trace
		}));
	}

	onMessage (event) {
		try {
			if (!event.data || !event.data.command) {
				Log.error(`Invalid message format\n${JSON.stringify(event)}`, 1);
				return;
			}

			switch (event.data.command) {
				case "ping":
					this.socket.write(JSON.stringify({
						sender: [],
						destination: [],
						data: {
							command: "pong"
						}
					}));
					return;
				case "pong":
					this.pingCounter = 0;
					return;
			}

			let ev = new Event(this.dispatcher, new Address(event.sender), new Address(event.destination), event.data, event.isResponse, event.trace);
			ev.dispatch();
		} catch (e) {
			Log.error("Invalid message format: " + e + "\n" + raw, 1);
		}
	}

	onClose () {
		Log.info("TCPConnection " + this.id + " closed", 1);

		this.send(this.address.parent, {
			command: "closeConnection",
			id: this.id
		});
	}

	onError (e) {
		Log.error("TCPConnection error: " + e, 1);

		this.send(this.address.parent, {
			command: "closeConnection",
			id: this.id
		});
	}

	ping () {
		this.pingCounter++;

		if (this.pingCounter == this.pingOptions.threshold) {
			Log.warning("TCPConnection " + this.id + " closed after " + this.pingOptions.threshold + " failed pings", 1);

			this.send(this.address.parent, {
				command: "closeConnection",
				id: this.id
			});
		} else {
			this.socket.write(JSON.stringify({
				sender: [],
				destination: [],
				data: {
					command: "ping"
				}
			}));
		}
	}
}

module.exports = TCPConnection;