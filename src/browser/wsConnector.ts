import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import { Node } from "../common/node.js"
import Log from "../utils/log.js"
import { serialize, deserialize } from "../utils/eventUtils.js"

export default class WSConnector extends Node {
	private registered: boolean = false;
	protected url: string;
	protected socket!: WebSocket;
	private options: { interval: number; threshold: number; };
	private messageHandle: (msg: any) => void;
	private errorHandle: (err: any) => void;
	private closeHandle: () => void;
	private pingInterval: ReturnType<typeof setInterval> | undefined;
	private pingCounter: number = 0;
	public readyPromise?: Promise<void>;
	private readyResolve?: () => void;
	private readyReject?: (err: any) => void;

	constructor (url: string, options: { interval: number; threshold: number; }) {
		super();
		this.options = options;
		this.url = url;

		this.messageHandle = this.onMessage.bind(this);
		this.errorHandle = this.onError.bind(this);
		this.closeHandle = this.onClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.readyPromise = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});

		this.socket = new WebSocket(this.url);
		this.socket.binaryType = "arraybuffer";

		this.socket.addEventListener("open", () => {
			this.socket.addEventListener("message", this.messageHandle);
			this.socket.addEventListener("error", this.errorHandle);
			this.socket.addEventListener("close", this.closeHandle);

			if (this.options.interval > 0) {
				this.pingInterval = setInterval(this.pingSocket.bind(this), this.options.interval);
			}
		});
	}

	detach () {
		this.socket.close();
		this.registered = false;
		this.pingCounter = 0;
		clearInterval(this.pingInterval);

		this.socket.removeEventListener("message", this.messageHandle);
		this.socket.removeEventListener("error", this.errorHandle);
		this.socket.removeEventListener("close", this.closeHandle);

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (this.address!.equals(address) || this.address!.isParentOf(address)) {
			super.dispatch(address, this.address!.data.length, event);
		} else {
			this.socket.send(serialize(event));
		}
	}

	onMessage (msg: MessageEvent) {
		let event;
		try {
			event = deserialize(this.dispatcher as Dispatcher, new Uint8Array(msg.data));
		} catch (e) {
			Log.error(`WSConnector: Invalid message format \n${JSON.stringify(msg.data)}`, 1);
			return;
		}

		switch (event.data.command) {
			case "ping":
				const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
					command: "pong"
				});

				this.socket.send(serialize(ev));
				break;
			case "pong":
				this.pingCounter = 0;
				break;
			case "register":
				if (this.registered) {
					Log.warning("WSConnector receved second register event " + this.address!.toString(), 1);
				} else {
					this.registered = true;
					const { address } = event.data.data as { address: string[] };
					this._address = new Address(address);
					Log.success("WSConnector registered with remote address " + this.address!.toString(), 1);
					this.readyResolve!();
					this.readyResolve = undefined;
					this.readyReject = undefined;
				}
				break;
			default:
				if (!this.registered) {
					Log.warning("WSConnector receiving data before registration\n" + JSON.stringify(event.data), 1);
				} else {
					event.dispatch();
				}
				break;
		}
	}

	onError (err: any) {
		Log.error("WSConnector error: " + err.toString(), 1);

		if (this.readyReject !== undefined) {
			this.readyReject(err);
			this.readyResolve = undefined;
			this.readyReject = undefined;
		}

		this.onClose();
	}

	onClose () {
		clearInterval(this.pingInterval);
		this.registered = false;
		this.socket.close();
	}

	pingSocket () {
		if (this.pingCounter == this.options.threshold) {
			Log.warning("WSConnector socket closed after " + this.options.threshold + " failed pings", 1);

			this.socket.close();
		} else {
			const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
				command: "ping"
			});

			this.socket.send(serialize(ev));
		}

		this.pingCounter++;
	}

	get isRegistered () {
		return this.registered;
	}
}