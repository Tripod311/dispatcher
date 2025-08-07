import type { Server as HTTPServer, IncomingMessage, ServerResponse } from 'http';
import type { Server as HTTPSServer } from 'https';
import Address from "../common/address.js"
import { Node } from "../common/node.js"
import { Event } from "../common/event.js"
import type { SerializedEvent } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import { MultipartParser } from "../utils/multipartParser.js"
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
		} catch (err: any) {
			Log.warning(err.toString(), 1);
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