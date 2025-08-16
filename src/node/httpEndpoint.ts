import type { Server as HTTPServer, IncomingMessage, ServerResponse } from 'http';
import type { Server as HTTPSServer } from 'https';
import Address from "../common/address.js"
import EndpointNode from "../common/endpointNode.js"
import { Event } from "../common/event.js"
import type { SerializedEvent } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import HTTPConnection from "./httpConnection.js"
import { serialize, deserialize } from "../utils/eventUtils.js"
import Log from "../utils/log.js"

export default class HTTPEndpoint extends EndpointNode {
	private server: HTTPServer | HTTPSServer;
	private sessionExpireTimeout: number = 10000;
	private sessionPollTimeout: number = 30000;
	private requestHandle: (request: IncomingMessage, response: ServerResponse) => void;
	private counter: number = 0;

	constructor (server: HTTPServer | HTTPSServer, sessionExpireTimeout?: number, sessionPollTimeout?: number, addresses?: Address[] | Set<Address>) {
		super(addresses);

		this.server = server;
		if (sessionExpireTimeout) this.sessionExpireTimeout = sessionExpireTimeout;
		if (sessionPollTimeout) this.sessionPollTimeout = sessionPollTimeout;

		this.requestHandle = this.onRequest.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.on("request", this.requestHandle);

		this.setListener("sessionExpired", this.sessionExpired.bind(this));
	}

	detach () {
		this.server.off("request", this.requestHandle);

		super.detach();
	}

	async onRequest (request: IncomingMessage, response: ServerResponse) {
		let event: Event;

		try {
			event = await this.readEvent(request);
		} catch (err: any) {
			Log.error("HTTPEndpoint error on reading event: " + err.toString(), 1);
			this.respondWithEvents(response, 500, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
				command: "error",
				data: {
					details: err.toString()
				}
			})]);
			return;
		}

		let connectionId;

		switch (event.data.command) {
			case "register":
				connectionId = (this.counter++).toString();

				const connectionAddress = this.address!.data;
				connectionAddress.push(connectionId);

				this.addChild(connectionId, new HTTPConnection(this.sessionExpireTimeout, this.sessionPollTimeout));

				this.respondWithEvents(response, 200, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
					command: "registerResponse",
					data: {
						address: connectionAddress,
						sessionExpireTimeout: this.sessionExpireTimeout
					}
				})]);
				break;
			case "poll":
				connectionId = event.sender.data[this.address!.length];

				if (this.subNodes[connectionId] !== undefined) {
					const queue = await (this.subNodes[connectionId] as HTTPConnection).poll();
					this.respondWithEvents(response, 200, queue);
				} else {
					this.respondWithEvents(response, 403, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
						command: "error",
						data: {
							details: "Session expired"
						}
					})]);
				}
				break;
			case "keepAlive":
				connectionId = event.sender.data[this.address!.length];

				if (this.subNodes[connectionId] !== undefined) {
					(this.subNodes[connectionId] as HTTPConnection).keepAlive();
					this.respondWithEvents(response, 200, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
						command: "keepAliveResponse"
					})]);
				} else {
					this.respondWithEvents(response, 403, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
						command: "error",
						data: {
							details: "Session expired"
						}
					})]);
				}
				break;
			default:
				connectionId = event.sender.data[this.address!.length];

				if (this.subNodes[connectionId] !== undefined) {
					if ((this.subNodes[connectionId] as HTTPConnection).restrictions.check(event.destination)) {
						event.dispatch();
					} else {
						Log.warning("HTTPConnection suppressed event to " + event.destination.toString(), 1);
					}

					this.respondWithEvents(response, 200, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
						command: "processed"
					})]);
				} else {
					this.respondWithEvents(response, 403, [new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
						command: "error",
						data: {
							details: "Session expired"
						}
					})]);
				}
				break;
		}
	}

	sessionExpired (event: Event) {
		const sessionId = event.sender.data[this.address!.data.length];

		this.delChild(sessionId);
	}

	readEvent (request: IncomingMessage): Promise<Event> {
		return new Promise((resolve, reject) => {
			const buffers: Buffer[] = [];

			request.on("data", chunk => {
				buffers.push(chunk);
			});

			request.on("end", () => {
				const buf = Buffer.concat(buffers);

				try {
					resolve(deserialize(this.dispatcher as Dispatcher, buf));
				} catch (err: any) {
					reject(err);
				}
			});

			request.on("error", (err) => {
				reject(err)
			});
		});
	}

	respondWithEvents (response: ServerResponse, code: number, events: Event[]) {
		const serialized = events.map(e => serialize(e));
		const totalLength = serialized.reduce((acc, val) => acc + val.length, 0);
		const responseBuffer = new Uint8Array(totalLength);

		let offset = 0;
		for (const arr of serialized) {
			responseBuffer.set(arr, offset);
			offset += arr.length;
		}

		response.writeHead(code, {
			'Content-Type': "application/octet-stream",
			'Content-Length': totalLength
		});
		response.end(responseBuffer);
	}
}