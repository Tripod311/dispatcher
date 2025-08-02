const {Worker,MessageChannel} = require("worker_threads");
const Node = require("../common/node.js");
const Event = require("../common/event.js");
const Address = require("../common/address.js");
const Log = require("../utils/log.js");

const WorkerPingInterval = 1000;

class ThreadNode extends Node {
	constructor (file, wOpts) {
		super();

		this.file = file;
		this.options = wOpts;
		this.worker = null;
		this.channel = null;

		this.state = ThreadNode.States.INITIAL;
		this.ping = null;
		this.pingCall = this.pingWorker.bind(this);
		this.pingCounter = 0;
	}

	attach (dispatcher, address) {
		super.attach.call(this,dispatcher,address);

		this.worker = new Worker(this.file, {
			workerData: Object.assign({},this.options,{
				address: this.address.data,
				logLevel: Log.getLogLevel()
			})
		});
		let c = new MessageChannel();
		this.channel = c.port1;
		this.worker.postMessage(c.port2, [c.port2]);
		this.channel.postMessage({
			command: "register",
			address: this.address.data
		});
		this.channel.on("message", this.channelMessage.bind(this));

		this.worker.on("error", this.onWorkerError.bind(this));

		this.state = ThreadNode.States.RUNNING;
		this.ping = setTimeout(this.pingCall, WorkerPingInterval);
	}

	detach () {
		clearTimeout(this.ping);

		this.channel.postMessage({
			command: "terminate"
		});
		// this.channel.close();
		this.state = ThreadNode.States.CLOSING;

		this.ping = setTimeout(() => {
			this.worker.terminate();
			this.channel.close();
			this.state = ThreadNode.States.DOWN;
		}, WorkerPingInterval);

		super.detach.call(this);
	}

	channelMessage (msg) {
		switch (msg.command) {
			case "event":
				if (this.state === ThreadNode.States.DOWN || this.state === ThreadNode.States.CLOSING) return;
				let event = new Event(this.dispatcher, new Address(msg.data.sender), new Address(msg.data.destination), msg.data.data, msg.data.isResponse, msg.data.trace);
				event.dispatch();
				break;
			case "pong":
				this.pingCounter = 0;
				break;
			case "terminated":
				clearTimeout(this.ping);
				this.channel.close();
				this.state = ThreadNode.States.DOWN;
				break;
		}
	}

	dispatch (address, hopIndex, event) {
		let transferList = event.captureTransfers();

		this.channel.postMessage({
			command: "event",
			data: {
				destination: event.destination.data,
				sender: event.sender.data,
				data: event.data,
				isResponse: event.isResponse,
				trace: event.trace
			}
		}, transferList);
	}

	onWorkerError (e) {
		clearTimeout(this.ping);
		if (this.address) {
			Log.error(`ThreadNode [${this.address.data.join(',')}] - Worker down\n${e.stack}`, 2);
		} else {
			Log.error(`ThreadNode [NO_ADDR] - Worker down\n${e.stack}`, 2);
		}
		this.state = ThreadNode.States.DOWN;
		this.worker.terminate();
	}

	pingWorker () {
		if (this.pingCounter > 5) {
			Log.error(`ThreadNode [${this.address.data.join(',')}] - Worker killed\nPing timeout`, 2);
			this.worker.terminate();
			this.state = ThreadNode.States.DOWN;
			clearTimeout(this.ping);
		} else {
			this.pingCounter++;
			this.channel.postMessage({
				command: "ping"
			});
			this.ping = setTimeout(this.pingCall, WorkerPingInterval);
		}
	}
}
ThreadNode.States = {
	INITIAL: 0,
	RUNNING: 1,
	CLOSING: 2,
	DOWN: 3
}

module.exports = ThreadNode;