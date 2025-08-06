import { Socket } from "net"
import { Node } from "../common/node.js"
import { Event } from "../common/event.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import type { EventData, SerializedEvent } from "../common/event.js"
import type { PingOptions } from "./tcpEndpoint.js"
import JSONStreamProcessor from "../utils/jsonStreamProcessor.js"
import Log from "../utils/log.js"

export default class TCPConnection extends Node {
	private id: string;
	private socket: Socket;
	private pingOptions: PingOptions;
	private messageHandle: (msg: any) => void;
	private errorHandle: (err: Error) => void;
	private closeHandle: () => void;
	private pingInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private pingCounter: number = 0;
	private processor!: JSONStreamProcessor;

	constructor (id: string, socket: Socket, pingOptions: PingOptions) {
		super();

		this.id = id;
		this.socket = socket;
		this.pingOptions = pingOptions;

		this.messageHandle = this.handleMessage.bind(this);
		this.errorHandle = this.handleError.bind(this);
		this.closeHandle = this.handleClose.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach.call(this, dispatcher, address);

		this.processor = new JSONStreamProcessor(this.socket);
		this.processor.on("message", this.messageHandle);
		this.socket.on("error", this.errorHandle);
		this.socket.on("close", this.closeHandle);

		if (this.pingOptions.interval > 0) {
			this.pingInterval = setInterval(this.pingSocket.bind(this), this.pingOptions.interval);
		}

		this.socket.write(JSON.stringify({
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
		this.processor.destructor();
		clearInterval(this.pingInterval);
		this.socket.end();
		this.socket.destroy();

		super.detach.call(this);
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		this.socket.write(JSON.stringify({
			sender: event.sender.data,
			destination: event.destination.data,
			data: event.data,
			isResponse: event.isResponse,
			trace: event.trace
		}));
	}

	handleMessage (message: any) {
		const event = message as SerializedEvent;

		try {
			if (!event.data.command) {
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

			let ev = new Event(this.dispatcher as Dispatcher, new Address(event.sender), new Address(event.destination), event.data, event.isResponse, event.trace);
			ev.dispatch();
		} catch (e) {
			Log.error("Invalid message format: " + e + "\n" + message.toString(), 1);
		}
	}

	handleError (err: Error) {
		Log.error("TCPConnection error: " + err.toString(), 1);

		if (this.address !== null) {
			this.send(this.address.parent, {
				command: "closeConnection",
				data: {
					id: this.id
				}
			});
		}
	}

	handleClose () {
		Log.info("TCPConnection " + this.id + " closed", 1);

		if (this.address !== null) {
			this.send(this.address.parent, {
				command: "closeConnection",
				data: {
					id: this.id
				}
			});
		}
	}

	pingSocket () {
		if (this.pingCounter == this.pingOptions.threshold) {
			Log.warning("TCPConnection " + this.id + " closed after " + this.pingOptions.threshold + " failed pings", 1);

			if (this.address !== null) {
				this.send(this.address.parent, {
					command: "closeConnection",
					data: {
						id: this.id
					}
				});
			}
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
}