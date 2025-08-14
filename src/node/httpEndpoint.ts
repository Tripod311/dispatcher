import type { Server as HTTPServer, IncomingMessage, ServerResponse } from 'http';
import type { Server as HTTPSServer } from 'https';
import Address from "../common/address.js"
import { Node } from "../common/node.js"
import { Event } from "../common/event.js"
import type { SerializedEvent } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import { MultipartParser } from "../utils/multipartParser.js"
import HTTPConnection from "./httpConnection.js"
import Log from "../utils/log.js"

export default class HTTPEndpoint extends Node {
	private server: HTTPServer | HTTPSServer;
	private sessionExpireTimeout: number = 10000;
	private sessionPollTimeout: number = 30000;
	private requestHandle: (request: IncomingMessage, response: ServerResponse) => void;
	private counter: number = 0;

	constructor (server: HTTPServer | HTTPSServer, sessionExpireTimeout?: number, sessionPollTimeout?: number) {
		super ();

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
		try {
			const contentType = request.headers["content-type"];

			let event: SerializedEvent;

			switch (contentType) {
				case "application/json":
					event = await HTTPEndpoint.readJSONBody(request);
					break;
				case "multipart/form-data":
					event = await MultipartParser.parse(request);
					break;
				default:
					throw new Error("Unsupported content-type " + contentType);
			}

			const command = event.data.command;

			if (!command) {
				response.writeHead(403, {
					"Content-Type": "application/json"
				});
				response.end(JSON.stringify({
					sender: [],
					destination: [],
					data: {
						command: "error",
						data: {
							details: "Event sent without command"
						}
					}
				}));
				return;
			}

			let connectionId;

			switch (command) {
				case "register":
					connectionId = (this.counter++).toString();

					const connectionAddress = this.address!.data;
					connectionAddress.push(connectionId);

					this.addChild(connectionId, new HTTPConnection(this.sessionExpireTimeout, this.sessionPollTimeout));

					response.writeHead(200, {
						'Content-Type': "application/json"
					});
					response.end(JSON.stringify({
						sender: [],
						destination: [],
						data: {
							command: "registerResponse",
							data: {
								address: connectionAddress,
								sessionExpireTimeout: this.sessionExpireTimeout
							}
						}
					}));
					break;
				case "poll":
					connectionId = event.sender[this.address!.length];

					if (this.subNodes[connectionId] !== undefined) {
						const queue = await (this.subNodes[connectionId] as HTTPConnection).poll();
						response.writeHead(200, {
							"Content-Type": "application/json"
						});
						response.end(JSON.stringify({
							sender: [],
							destination: [],
							data: {
								command: "pollResponse",
								data: {
									events: queue
								}
							}
						}));
					} else {
						response.writeHead(403, {
							'Content-Type': "application/json"
						});
						response.end(JSON.stringify({
							sender: [],
							destination: [],
							data: {
								command: "error",
								data: {
									details: "Session expired"
								}
							}
						}));
					}
					break;
				case "keepAlive":
					connectionId = event.sender[this.address!.length];

					if (this.subNodes[connectionId] !== undefined) {
						(this.subNodes[connectionId] as HTTPConnection).keepAlive();
						response.writeHead(200, {
							'Content-Type': "application/json"
						});
						response.end(JSON.stringify({
							sender: [],
							destination: [],
							data: {
								command: "keepAliveResponse"
							}
						}));
					} else {
						response.writeHead(403, {
							'Content-Type': "application/json"
						});
						response.end(JSON.stringify({
							sender: [],
							destination: [],
							data: {
								command: "error",
								data: {
									details: "Session expired"
								}
							}
						}));
					}
					break;
				default:
					connectionId = event.sender[this.address!.length];

					if (this.subNodes[connectionId] !== undefined) {
						(this.subNodes[connectionId] as HTTPConnection).process(event);
						response.writeHead(200, {
							"Content-Type": "application/json"
						});
						response.end(JSON.stringify({error: false}));
					} else {
						response.writeHead(403, {
							'Content-Type': "application/json"
						});
						response.end(JSON.stringify({
							sender: [],
							destination: [],
							data: {
								command: "error",
								data: {
									details: "Session expired"
								}
							}
						}));
					}
					break;
			}
		} catch (err: any) {
			const details = "HTTPEndpoint error on event processing: " + err.toString();
			Log.warning(details, 1);

			response.writeHead(403, {
				'Content-Type': "application/json"
			});
			response.end(JSON.stringify({
				sender: [],
				destination: [],
				data: {
					command: "error",
					data: {
						details: details
					}
				}
			}));
		}
	}

	sessionExpired (event: Event) {
		const sessionId = event.sender.data[this.address!.data.length];

		this.delChild(sessionId);
	}

	private static readJSONBody (request: IncomingMessage): Promise<SerializedEvent> {
		return new Promise<SerializedEvent>((resolve, reject) => {
			let body: Buffer[] = [];

			request.on('data', (chunk) => {
				body.push(chunk);
			});

			request.on('end', () => {
				try {
					resolve(JSON.parse(body.join('')) as SerializedEvent);
				} catch (err: any) {
					reject("JSON parsing error: " + err.toString());
				}
			});

			request.on('error', (err: any) => {
				reject("Request error " + err.toString());
			});
		});
	}
}