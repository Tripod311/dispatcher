import type { WebSocketServer, WebSocket } from "ws"
import { Node } from "../common/node.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import { Event } from "../common/event.js"
import WSConnection from "./wsConnection.js"
import Log from "../utils/log.js"

export interface WSEndpointOptions {
	interval: number;
	threshold: number;
}

export class WSEndpoint extends Node {
	private server: WebSocketServer;
	private options: WSEndpointOptions;
	private connectionHandle: (ws: WebSocket) => void;
	private errorHandle: (err: any) => void;
	private counter: number = 0;

	constructor(server: WebSocketServer, options: WSEndpointOptions) {
		super();

		this.server = server;
		this.options = options;

		this.connectionHandle = this.onConnection.bind(this);
		this.errorHandle = this.onError.bind(this);

		this.setListener("closeConnection", this.closeConnection.bind(this));
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.on("connection", this.connectionHandle);
		this.server.on("error", this.errorHandle);
	}

	detach () {
		this.server.off("connection", this.connectionHandle);
		this.server.off("error", this.errorHandle);

		super.detach();
	}

	onConnection (socket: WebSocket) {
		let id = this.counter++;
		this.addChild(id.toString(), new WSConnection(socket, this.options));
	}

	onError (err: any) {
		Log.error("WSEndpoint error: " + err.toString(), 1);
	}

	closeConnection (event: Event) {
		const id = event.sender.data[this.address!.length];
		this.delChild(id);
	}
}