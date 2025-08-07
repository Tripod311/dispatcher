import type { IncomingMessage } from 'http';
import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import { Node } from "../common/node.js"
import type Dispatcher from "../common/dispatcher.js"

export default class HTTPConnection extends Node {
	public sessionVariables: Record<string, any> = {};
	private expireTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
	private sessionLifetime: number;

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

	expire () {
		this.send(this.address!.parent, {
			command: "sessionExpired"
		});
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