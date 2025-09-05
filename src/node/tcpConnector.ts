import type { Socket } from "net"
import Net from "net"
import { Node } from "../common/node.js"
import { Event } from "../common/event.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import StreamProcessor from "../utils/streamProcessor.js"
import { serialize } from "../utils/eventUtils.js"
import Log from "../utils/log.js"

export interface TCPConnectorOptions {
	interval: number;
	threshold: number;
	host: string;
	port: number;
}

export class TCPConnector extends Node {
	private options: TCPConnectorOptions;
	protected socket!: Socket;
	private processor!: StreamProcessor;
	private registered: boolean = false;
	private pingCounter: number = 0;
	private pingInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private connectedHandle: () => void;
	private messageHandle: (event: Event) => void;
	private errorHandle: (err: Error) => void;
	private closeHandle: () => void;
	public readyPromise?: Promise<void>;
	private readyResolve?: () => void;
	private readyReject?: (err: any) => void;

	constructor (options: TCPConnectorOptions) {
		super ();

		this.options = options;

		this.connectedHandle = this.onOpen.bind(this);
		this.messageHandle = this.onMessage.bind(this);
		this.errorHandle = this.onError.bind(this);
		this.messageHandle = this.onMessage.bind(this);
		this.closeHandle = this.onClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		try {
			this.readyPromise = new Promise((resolve, reject) => {
				this.readyResolve = resolve;
				this.readyReject = reject;
			});

			this.socket = Net.createConnection(this.options.port, this.options.host);
			this.socket.on("connect", this.connectedHandle);
			this.processor = new StreamProcessor(this.dispatcher as Dispatcher, this.socket);
			this.processor.on("message", this.messageHandle);
			this.socket.on("error", this.errorHandle);
			this.socket.on("close", this.closeHandle)
		} catch (e) {
			this.errorHandle(e as Error);
		}
	}

	detach () {
		clearInterval(this.pingInterval);
		this.pingCounter = 0;
		this.socket.destroy();

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (this.address!.equals(address) || this.address!.isParentOf(address)) {
			super.dispatch(address, this.address!.data.length, event);
		} else {
			this.socket.write(serialize(event));
		}
	}

	onOpen () {
		Log.info("TCPConnector connected successfully", 1);
		if (this.options.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.options.interval);
		}
	}

	onMessage (event: Event) {
		switch (event.data.command) {
			case "ping":
				const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
					command: "pong"
				});

				this.socket.write(serialize(ev));
				break;
			case "pong":
				this.pingCounter = 0;
				break;
			case "register":
				if (this.registered) {
					Log.warning("TCPConnector received second register event " + this.address!.toString(), 1);
				} else {
					this.registered = true;
					const { address } = event.data.data as { address: string[] };
					this._address = new Address(address);
					Log.success("TCPconnector registered with remote address " + this.address!.toString(), 1);
					this.readyResolve!();
					this.readyResolve = undefined;
					this.readyReject = undefined;
				}
				break;
			default:
				if (!this.registered) {
					Log.warning("TCPConnector receiving data before registration\n" + JSON.stringify(event.data), 1);
				} else {
					event.dispatch();
				}
				break;
		}
	}

	onClose () {
		clearInterval(this.pingInterval);
		this.pingCounter = 0;
		this.socket.end();
	}

	onError (err: Error) {
		Log.error("TCPConnector socket error: " + err.toString(), 1);
		this.onClose();
		this.readyReject && this.readyReject(err);
	}

	pingSocket () {
		if (this.pingCounter == this.options.threshold) {
			Log.warning("TCPConnector socket closed after " + this.options.threshold + " failed pings", 1);

			this.socket.end();
		} else {
			const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
				command: "ping"
			});

			this.socket.write(serialize(ev));
		}

		this.pingCounter++;
	}

	get isRegistered () {
		return this.registered;
	}
}