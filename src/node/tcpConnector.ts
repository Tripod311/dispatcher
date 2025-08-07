import type { Socket } from "net"
import Net from "net"
import { Node } from "../common/node.js"
import { Event } from "../common/event.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import type { EventData, SerializedEvent } from "../common/event.js"
import JSONStreamProcessor from "../utils/jsonStreamProcessor.js"
import Log from "../utils/log.js"

export interface TCPConnectorOptions {
	interval: number;
	threshold: number;
	host: string;
	port: number;
}

export class TCPConnector extends Node {
	private options: TCPConnectorOptions;
	private socket!: Socket;
	private processor!: JSONStreamProcessor;
	private registered: boolean = false;
	private pingCounter: number = 0;
	private pingInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private connectedHandle: () => void;
	private messageHandle: (msg: any) => void;
	private errorHandle: (err: Error) => void;
	private closeHandle: () => void;

	constructor (options: TCPConnectorOptions) {
		super ();

		this.options = options;

		this.connectedHandle = this.onOpen.bind(this);
		this.messageHandle = this.onMessage.bind(this);
		this.errorHandle = this.onError.bind(this);
		this.closeHandle = this.onClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		try {
			this.socket = Net.createConnection(this.options.port, this.options.host);
			this.socket.on("connect", this.connectedHandle);
			this.processor = new JSONStreamProcessor(this.socket);
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
		if (this.address!.isParentOf(address)) {
			super.dispatch(address, this.address!.data.length, event);
		} else {
			this.socket.write(JSON.stringify({
				sender: event.sender.data,
				destination: event.destination.data,
				data: event.data,
				isResponse: event.isResponse,
				trace: event.trace
			}));
		}
	}

	onOpen () {
		Log.info("TCPConnector connected successfully", 1);
		if (this.options.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.options.interval);
		}
	}

	onMessage (msg: any) {
		const event = msg as SerializedEvent;

		if (!event.data || !event.data.command) {
			Log.error(`TCPConnector: Invalid message format \n${JSON.stringify(msg)}`, 1);
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
				break;
			case "pong":
				this.pingCounter = 0;
				break;
			case "register":
				this.registered = true;
				const { address } = event.data.data as { address: string[] };
				this._address = new Address(address);
				Log.success("TCPconnector registered with remote address " + this.address!.toString(), 1);
				break;
			default:
				if (!this.registered) {
					Log.warning("TCPConnector receiving data before registration\n" + JSON.stringify(event.data), 1);
				} else {
					let rev = new Event(this.dispatcher as Dispatcher, new Address(event.sender), new Address(event.destination), event.data, event.isResponse, event.trace);
					rev.dispatch();
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
	}

	pingSocket () {
		if (this.pingCounter == this.options.threshold) {
			Log.warning("TCPConnector socket closed after " + this.options.threshold + " failed pings", 1);

			this.socket.end();
		} else {
			this.socket.write(JSON.stringify({
				sender: [],
				destination: [],
				data: {
					command: "ping"
				}
			}));
		}

		this.pingCounter++;
	}

	get isRegistered () {
		return this.registered;
	}
}