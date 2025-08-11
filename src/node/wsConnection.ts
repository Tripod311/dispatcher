import type { WebSocket } from "ws"
import { Node } from "../common/node.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import Log from "../utils/log.js"

export default class WSConnection extends Node {
	private socket: WebSocket;
	private options: { interval: number; threshold: number; };
	private messageHandle: (msg: any) => void;
	private errorHandle: (err: any) => void;
	private closeHandle: () => void;
	private pingInterval: ReturnType<typeof setInterval> | undefined;
	private pingCounter: number = 0;

	constructor (socket: WebSocket, options: { interval: number; threshold: number; }) {
		super ();
		this.socket = socket;
		this.options = options;

		this.messageHandle = this.onMessage.bind(this);
		this.errorHandle = this.onError.bind(this);
		this.closeHandle = this.onClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.socket.on("message", this.messageHandle);
		this.socket.on("error", this.errorHandle);
		this.socket.on("close", this.closeHandle);

		if (this.options.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.options.interval);
		}

		this.socket.send(JSON.stringify({
			sender: [],
			destination: [],
			data: {
				command: "register",
				data: {
					address: this.address!.data
				}
			}
		}));
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
		this.socket.send(JSON.stringify({
			sender: event.sender.data,
			destination: event.destination.data,
			data: event.data,
			isResponse: event.isResponse,
			trace: event.trace,
			reqId: event.reqId
		}));
	}

	onMessage (msg: any) {
		let ev;

		try {
			ev = JSON.parse(msg) as SerializedEvent;

			if (!ev.data || !ev.data.command) {
				Log.error("WSConnection invalid message format: " + msg, 1);
				return;
			}
		} catch (e) {
			Log.error("WSConnection invalid message format: " + msg, 1);
			return;
		}

		switch (ev.data.command) {
			case "ping":
				this.socket.send(JSON.stringify({
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

		const rev = new Event(this.dispatcher as Dispatcher, new Address(ev.sender), new Address(ev.destination), ev.data, ev.isResponse, ev.trace);
		rev.reqId = ev.reqId;
		rev.dispatch();
	}

	onError (err: any) {
		Log.error("WSConnection error: " + err.toString(), 1);
		this.onClose();
	}

	onClose () {
		if (this.address !== null) {
			Log.info("WSConnection " + this.id + " closed", 1);

			this.send(this.address!.parent, {
				command: "closeConnection"
			});
		}
	}

	pingSocket () {
		if (this.pingCounter == this.options.threshold) {
			Log.warning("TCPConnection " + this.id + " closed after " + this.options.threshold + " failed pings", 1);

			if (this.address !== null) {
				this.send(this.address.parent, {
					command: "closeConnection"
				});
			}
		} else {
			this.socket.send(JSON.stringify({
				sender: [],
				destination: [],
				data: {
					command: "ping"
				}
			}));
		}

		this.pingCounter++;
	}
}