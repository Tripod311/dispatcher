const {workerData,parentPort} = require("worker_threads");
const EventEmitter = require("events");
const Dispatcher = require("../common/dispatcher.js");
const Node = require("../common/node.js");
const Address = require("../common/address.js");
const Event = require("../common/event.js");
const Log = require("../utils/log.js");

class ThreadConnector extends EventEmitter {
	constructor () {
		super ();

		this.registered = false;
		this.address = null;
		this.dispatcher = new Dispatcher();
		this.dispatcher.setRoute(this.processEvent.bind(this));
		Log.setLogLevel(workerData.logLevel);

		parentPort.once("message", (channel) => {
			this.channel = channel;
			this.channel.on("message", this.channelMessage.bind(this));
		});
	}

	destructor () {
		this.emit("terminate");
		this.dispatcher.removeRoot();
		Log.info("Thread connector :: " + this.address.print() + " destroyed", 4);
		this.registered = false;
		super.removeAllListeners.call(this);
		this.channel.postMessage({
			command: "terminated"
		});
	}

	channelMessage (msg) {
		if (this.registered) {
			switch (msg.command) {
				case "ping":
					this.channel.postMessage({
						command: "pong"
					});
					break;
				case "terminate":
					this.destructor();
					break;
				case "event":
					let ev = new Event(this.dispatcher, new Address(msg.data.sender), new Address(msg.data.destination), msg.data.data, msg.data.isResponse, msg.data.trace);
					ev.dispatch();
					break;
			}
		} else {
			if (msg.command === "register") {
				this.registered = true;
				this.address = new Address(msg.address);
				Log.success("Thread connector :: " + this.address.print() + " registered", 4);
				this.emit("ready", workerData);
			}
		}
	}

	processEvent (ev) {
		if (!this.registered) return;
		if (this.address.isParentOf(ev.destination)) {
			this.dispatcher.getRoot().dispatch(ev.destination, this.address.data.length, ev);
		} else {
			let transferList = ev.captureTransfers();

			this.channel.postMessage({
				command: "event",
				data: {
					sender: ev.sender.data,
					destination: ev.destination.data,
					data: ev.data,
					isResponse: ev.isResponse,
					trace: ev.trace
				}
			}, transferList);
		}
	}

	setRoot (rootNode) {
		this.dispatcher.setRoot(rootNode, this.address);
	}
}

module.exports = ThreadConnector;