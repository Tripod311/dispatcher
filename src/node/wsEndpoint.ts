import type { WebSocketServer, WebSocket } from "ws"
import EndpointNode from "../common/endpointNode.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import { Event } from "../common/event.js"
import WSConnection from "./wsConnection.js"
import Log from "../utils/log.js"

export default class WSEndpoint extends EndpointNode {
	protected server: WebSocketServer;
	private options: { interval: number; threshold: number };
	private connectionHandle: (ws: WebSocket) => void;
	private errorHandle: (err: any) => void;
	private counter: number = 0;

	constructor(server: WebSocketServer, options: { interval: number; threshold: number }) {
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