import type { Server, Socket } from "net"
import { Node } from "../common/node.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import type { EventData } from "../common/event.js"
import { Event } from "../common/event.js"
import TCPConnection from "./tcpConnection.js"
import Log from "../utils/log.js"

export interface PingOptions {
	threshold: number;
	interval: number;
}

export class TCPEndpoint extends Node {
	private server: Server;
	private pingOptions: PingOptions;
	private connectionHandle: (socket: Socket) => void;
	private errorHandle: (err: Error) => void;
	private counter: number = 0;

	constructor (server: Server, pingOptions: PingOptions = { threshold: 5, interval: 5000 }) {
		super();
		
		this.server = server;
		this.pingOptions = pingOptions;
		this.connectionHandle = this.handleConnection.bind(this);
		this.errorHandle = this.handleError.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach.call(this, dispatcher, address);

		this.server.on("connection", this.connectionHandle);
		this.server.on("error", this.errorHandle);

		this.setListener("closeConnection", this.closeConnection.bind(this));
	}

	handleConnection (socket: Socket) {
		let id = (this.counter++).toString();
		this.addChild(id, new TCPConnection(id, socket, this.pingOptions));
	}

	handleError (err: Error) {
		Log.error("TCPEndpoint error: " + err.toString(), 1);
	}

	closeConnection (event: Event) {
		const { id } = event.data.data as { id: string };
		this.delChild(id);
	}
}