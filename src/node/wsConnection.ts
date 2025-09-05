import type { WebSocket } from "ws"
import ConnectionNode from "../common/connectionNode.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import { Event } from "../common/event.js"
import { serialize, deserialize } from "../utils/eventUtils.js"
import Log from "../utils/log.js"

export default class WSConnection extends ConnectionNode {
	protected socket: WebSocket;
	private options: { interval: number; threshold: number; };
	private messageHandle: (msg: any) => void;
	private errorHandle: (err: any) => void;
	private closeHandle: () => void;
	private pingInterval: ReturnType<typeof setInterval> | undefined;
	private pingCounter: number = 0;
	private onClose: (id: string) => void;

	constructor (socket: WebSocket, options: { interval: number; threshold: number; }, onClose: (id: string) => void) {
		super ();
		this.socket = socket;
		this.options = options;
		this.onClose = onClose;

		this.messageHandle = this.handleMessage.bind(this);
		this.errorHandle = this.handleError.bind(this);
		this.closeHandle = this.handleClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.socket.on("message", this.messageHandle);
		this.socket.on("error", this.errorHandle);
		this.socket.on("close", this.closeHandle);

		if (this.options.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.options.interval);
		}

		const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
			command: "register",
			data: {
				address: this.address!.data
			}
		});

		this.socket.send(serialize(ev));
	}

	detach () {
		clearInterval(this.pingInterval);

		this.socket.off("message", this.messageHandle);
		this.socket.off("error", this.errorHandle);
		this.socket.off("close", this.closeHandle);

		this.socket.close();

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		this.socket.send(serialize(event));
	}

	handleMessage (msg: any) {
		let ev: Event | undefined;

		try {
			ev = deserialize(this.dispatcher as Dispatcher, msg);
		} catch (e) {
			Log.error("WSConnection invalid message format: " + msg, 1);
			return;
		}

		switch (ev!.data.command) {
			case "ping":
				const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
					command: "pong",
					data: {
						address: this.address!.data
					}
				});

				this.socket.send(serialize(ev));
				return;
			case "pong":
				this.pingCounter = 0;
				return;
		}

		if (this.restrictions.check(ev.destination)) {
			ev.dispatch();
		} else {
			Log.warning('WSConnection suppressed event to ' + ev.destination.toString(), 1);
			ev.response({
				command: ev.data.command + "Response",
				error: true,
				details: 'WSConnection suppressed event to ' + ev.destination.toString()
			});
		}
	}

	handleError (err: any) {
		Log.error("WSConnection error: " + err.toString(), 1);
		this.handleClose();
	}

	handleClose () {
		if (this.address !== null) {
			Log.info("WSConnection " + this.address!.toString() + " closed", 1);

			this.onClose(this.id);
		}
	}

	pingSocket () {
		if (this.pingCounter == this.options.threshold) {
			Log.warning("TCPConnection " + this.address!.toString() + " closed after " + this.options.threshold + " failed pings", 1);

			if (this.address !== null) {
				this.onClose(this.id);
			}
		} else {
			const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
				command: "ping",
				data: {
					address: this.address!.data
				}
			});

			this.socket.send(serialize(ev));
		}

		this.pingCounter++;
	}

	get id () {
		return this.address!.data[this.address!.data.length - 1];
	}
}