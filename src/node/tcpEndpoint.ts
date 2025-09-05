import type { Server, Socket } from "net"
import EndpointNode from "../common/endpointNode.js"
import Address from "../common/address.js"
import type Dispatcher from "../common/dispatcher.js"
import { Event } from "../common/event.js"
import TCPConnection from "./tcpConnection.js"
import Log from "../utils/log.js"

export default class TCPEndpoint extends EndpointNode {
	protected server: Server;
	private pingOptions: { interval: number; threshold: number };
	private connectionHandle: (socket: Socket) => void;
	private errorHandle: (err: Error) => void;
	private counter: number = 0;

	constructor (server: Server, pingOptions: { interval: number; threshold: number } = { threshold: 5, interval: 5000 }, addresses?: Address[] | Set<Address>) {
		super(addresses);
		
		this.server = server;
		this.pingOptions = pingOptions;
		this.connectionHandle = this.handleConnection.bind(this);
		this.errorHandle = this.handleError.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.on("connection", this.connectionHandle);
		this.server.on("error", this.errorHandle);

		this.restrictions.add(this.address!);
	}

	handleConnection (socket: Socket) {
		let id = (this.counter++).toString();
		this.addChild(id, new TCPConnection(socket, this.pingOptions, this.closeConnection.bind(this)));
	}

	handleError (err: Error) {
		Log.error("TCPEndpoint error: " + err.toString(), 1);
	}

	closeConnection (id: string) {
		this.delChild(id);
	}
}