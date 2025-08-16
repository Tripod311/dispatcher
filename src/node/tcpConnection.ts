import { Socket } from "net"
import ConnectionNode from "../common/connectionNode.js"
import { Event } from "../common/event.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import StreamProcessor from "../utils/streamProcessor.js"
import JSONStreamProcessor from "../utils/jsonStreamProcessor.js"
import { serialize } from "../utils/eventUtils.js"
import Log from "../utils/log.js"

export default class TCPConnection extends ConnectionNode {
	private socket: Socket;
	private pingOptions: { interval: number; threshold: number };
	private messageHandle: (event: Event) => void;
	private errorHandle: (err: Error) => void;
	private closeHandle: () => void;
	private pingInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private pingCounter: number = 0;
	private processor!: StreamProcessor;

	constructor (socket: Socket, pingOptions: { interval: number; threshold: number }) {
		super();

		this.socket = socket;
		this.pingOptions = pingOptions;

		this.messageHandle = this.handleMessage.bind(this);
		this.errorHandle = this.handleError.bind(this);
		this.closeHandle = this.handleClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.processor = new StreamProcessor(this.dispatcher as Dispatcher, this.socket);
		this.processor.on("message", this.messageHandle);
		this.socket.on("error", this.errorHandle);
		this.socket.on("close", this.closeHandle);

		if (this.pingOptions.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.pingOptions.interval);
		}

		const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
			command: "register",
			data: {
				address: this.address!.data
			}
		});

		this.socket.write(serialize(ev));
	}

	detach () {
		this.processor.destructor();
		clearInterval(this.pingInterval);
		this.socket.on("error", this.errorHandle);
		this.socket.on("close", this.closeHandle);
		this.socket.end();
		this.socket.destroy();

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		this.socket.write(serialize(event));
	}

	handleMessage (event: Event) {
		switch (event.data.command) {
			case "ping":
				const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
					command: "pong",
					data: {
						address: this.address!.data
					}
				});

				this.socket.write(serialize(ev));
				return;
			case "pong":
				this.pingCounter = 0;
				return;
		}
		
		if (this.restrictions.check(event.destination)) {
			event.dispatch();
		} else {
			Log.warning('TCPConnection suppressed event to ' + event.destination.toString(), 1);
		}
	}

	handleError (err: Error) {
		Log.error("TCPConnection error: " + err.toString(), 1);

		this.handleClose();
	}

	handleClose () {
		if (this.address !== null) {
			this.send(this.address.parent, {
				command: "closeConnection"
			});
		}
	}

	pingSocket () {
		if (this.pingCounter == this.pingOptions.threshold) {
			Log.warning("TCPConnection " + this.address!.toString() + " closed after " + this.pingOptions.threshold + " failed pings", 1);

			if (this.address !== null) {
				this.send(this.address.parent, {
					command: "closeConnection"
				});
			}
		} else {
			const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
				command: "ping",
				data: {
					address: this.address!.data
				}
			});

			this.socket.write(serialize(ev));
		}

		this.pingCounter++;
	}
}