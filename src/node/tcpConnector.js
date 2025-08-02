const Net = require("net");
const Address = require("../common/address.js");
const Event = require("../common/event.js");
const Node = require("../common/node.js");
const Dispatcher = require("../common/dispatcher.js");
const Log = require("../utils/log.js");
const JSONStreamProcessor = require("../utils/jsonStreamProcessor.js");

class TCPConnector extends Node {
	constructor (options) {
		super ();

		this.options = options;
		if (!this.options.interval) this.options.interval = 5000;
		if (!this.options.threshold) this.options.threshold = 5;

		this.registered = false;
		this.remoteAddress = null;
		this.pingCounter = 0;

		this.proxy = {
			connected: this.onConnected.bind(this),
			message: this.onMessage.bind(this),
			error: this.onError.bind(this),
			close: this.onClose.bind(this)
		}
	}

	attach (dispatcher, address) {
		super.attach.call(this, dispatcher, address);

		try {
			this.socket = Net.createConnection(this.options.port, this.options.host);
			this.socket.on("connect", this.proxy.connected);
			this.processor = new JSONStreamProcessor(this.socket);
			this.processor.on("message", this.proxy.message);
			this.socket.on("error", this.proxy.error);
			this.socket.on("close", this.proxy.close)
		} catch (e) {
			this.socketError(e);
		}
	}

	detach () {
		this.socket.close();

		super.detach.call(this);
	}

	onConnected () {
		Log.info("TCPConnector connected successfully", 1);
		this.pingInterval = setInterval(this.pingSocket, this.options.interval);
	}

	onMessage (ev) {
		if (!ev.data || !ev.data.command) {
			Log.error(`TCPConnector: Invalid event\n${JSON.stringify(ev)}`, 1);
			return;
		}

		switch (ev.data.command) {
			case "ping":
				this.socket.write(JSON.stringify({
					sender: [],
					destination: [],
					data: {
						command: "pong"
					}
				}));
				break;
			case "pong":
				this.pingCounter = 0;
				break;
			case "register":
				this.registered = true;
				this.remoteAddress = new Address(ev.data.address);
				Log.success("TCPconnector registered with remote address " + this.remoteAddress.print(), 1);
				break;
			default:
				if (!this.registered) {
					Log.warning("TCPConnector receiving data before registration\n" + JSON.stringify(ev.data), 1);
				} else {
					let rev = new Event(this.dispatcher, new Address(ev.sender), new Address(ev.destination), ev.data, ev.isResponse, ev.trace);
					rev.dispatch();
				}
				break;
		}
	}

	onError (e) {
		Log.error("TCPConnector socket error: " + e, 1);
		this.socket.end();
		this.socket.destroy();
	}

	onClose () {
		clearInterval(this.pingInterval);
		if (this.options.onClose) this.options.onClose();
	}

	pingSocket () {
		this.pingCounter++;

		if (this.pingCounter == this.options.threshold) {
			Log.warning("TCPConnector socket closed after " + this.options.threshold + " failed pings", 1);

			this.socket.close();
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

module.exports = TCPConnector;