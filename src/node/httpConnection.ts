import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import { Node } from "../common/node.js"
import type Dispatcher from "../common/dispatcher.js"

export default class HTTPConnection extends Node {
	private variables: Record<string, any> = {};
	private expireTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
	private sessionLifetime: number;
	private sessionPollTime: number;
	private queue: Event[] = [];
	private currentPoll: ((q: SerializedEvent[]) => void) | undefined = undefined;
	private currentPollExpireTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

	constructor (sessionLifetime: number, sessionPollTime: number) {
		super();

		this.sessionLifetime = sessionLifetime;
		this.sessionPollTime = sessionPollTime;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.expireTimeout = setTimeout(this.expire.bind(this), this.sessionLifetime);
		this.setListener("keepAlive", this.keepAlive.bind(this));
	}

	detach () {
		clearTimeout(this.expireTimeout);
		clearTimeout(this.currentPollExpireTimeout);

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		this.queue.push(event);

		if (this.currentPoll !== undefined) {
			this.currentPoll(this.clearQueue());
			this.currentPoll = undefined;
		}
	}

	expire () {
		this.send(this.address!.parent, {
			command: "sessionExpired"
		});
	}

	keepAlive () {
		clearTimeout(this.expireTimeout);

		this.expireTimeout = setTimeout(this.expire.bind(this), this.sessionLifetime);
	}

	process (event: SerializedEvent) {
		const ev = new Event(this.dispatcher as Dispatcher, new Address(this.address as Address), new Address(event.destination), event.data, event.isResponse, event.trace);

		ev.dispatch();
	}

	async poll (): Promise<SerializedEvent[]> {
		if (this.queue.length > 0) {
			return this.clearQueue();
		} else {
			this.currentPollExpireTimeout = setTimeout(this.clearPoll.bind(this), this.sessionPollTime);
			return new Promise((resolve) => {
				this.currentPoll = resolve;
			});
		}
	}

	private clearPoll () {
		this.currentPoll!([]);
		this.currentPoll = undefined;
	}

	private clearQueue (): SerializedEvent[] {
		let result = [];
		for (let i=0; i<this.queue.length; i++) {
			const ev = this.queue[i];
			result.push({
				sender: ev.sender.data,
				destination: ev.destination.data,
				data: ev.data,
				isResponse: ev.isResponse,
				trace: ev.trace,
				reqId: ev.reqId
			});
		}
		this.queue = [];
		return result;
	}
}