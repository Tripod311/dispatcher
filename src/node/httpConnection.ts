import type { ServerResponse } from 'http';
import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import { Node } from "../common/node.js"
import type Dispatcher from "../common/dispatcher.js"

export default class HTTPConnection extends Node {
	private variables: Record<string, any> = {};
	private expireTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
	private sessionLifetime: number;
	private queue: Event[] = [];

	constructor (sessionLifetime: number) {
		super();

		this.sessionLifetime = sessionLifetime;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.expireTimeout = setTimeout(this.expire.bind(this), this.sessionLifetime);
	}

	detach () {
		clearTimeout(this.expireTimeout);

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		this.queue.push(event);
	}

	expire () {
		this.send(this.address!.parent, {
			command: "sessionExpired"
		});
	}

	process (event: SerializedEvent) {
		const ev = new Event(this.dispatcher as Dispatcher, new Address(this.address as Address), new Address(event.destination), event.data, event.isResponse, event.trace);

		ev.dispatch();
	}

	poll (response: ServerResponse) {
		response.writeHead(200, {
			"Content-Type": "application/json"
		});
		response.write(JSON.stringify({
			sender: [],
			destination: [],
			data: {
				command: "pollResponse",
				data: {
					events: JSON.stringify(this.queue.map(e => e.serialize()))
				}
			}
		}));
		this.queue = [];
	}

	public static randomId (): string {
		const chars = "abcdefghijklmonpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		const result = [];
		for (let i=0; i<10; i++) {
			result.push(chars[Math.floor(Math.random() * chars.length)]);
		}
		return result.join('');
	}
}