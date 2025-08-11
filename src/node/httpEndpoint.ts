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
	private requestHandle: (request: IncomingMessage, response: ServerResponse) => void;

	constructor (server: HTTPServer | HTTPSServer, sessionExpireTimeout?: number) {
		super ();

		this.server = server;
		if (sessionExpireTimeout) this.sessionExpireTimeout = sessionExpireTimeout;

		this.requestHandle = this.onRequest.bind(this);
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.server.on("request", this.requestHandle);
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

			if (command === "register") {
				const id = HTTPConnection.randomId();

				const connectionAddress = this.address.data;
				connectionAddress.push(id);

				this.addChild(id, new HTTPConnection(this.sessionLifetime));

				response.writeHead(200, {
					'Content-Type': "application/json"
				});
				response.write(JSON.stringify({
					sender: [],
					destination: [],
					data: {
						command: "registerResponse",
						data: {
							address: connectionAddress,
							sessionLifetime: this.sessionLifetime
						}
					}
				}));
				response.end();
			} else {
				const connectionId = event.data.sender[this.address.length];

				if (this.subNodes[connectionId] !== undefined) {
					this.subNodes[connectionId].process(event, response);
				} else {
					response.writeHead(403, {
						'Content-Type': "application/json"
					});
					response.write(JSON.stringify({
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
			}
		} catch (err: any) {
			const details = "HTTPEndpoint error on event processing: " + err.toString();
			Log.warning(details, 1);

			response.writeHead(403, {
				'Content-Type': "application/json"
			});
			response.write(JSON.stringify({
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