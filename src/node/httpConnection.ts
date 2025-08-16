import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import СonnectionNode from "../common/connectionNode.js"
import type Dispatcher from "../common/dispatcher.js"
import Restrictions from "../common/restrictions.js"

export default class HTTPConnection extends СonnectionNode {
	private variables: Record<string, any> = {};
	private expireTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
	private sessionLifetime: number;
	private sessionPollTime: number;
	private queue: Event[] = [];
	private currentPoll: ((q: Event[]) => void) | undefined = undefined;
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

	poll (): Promise<Event[]> {
		return new Promise((resolve, reject) => {
			if (this.queue.length > 0) {
				resolve(this.clearQueue())
			} else {
				this.currentPollExpireTimeout = setTimeout(this.clearPoll.bind(this), this.sessionPollTime);
				this.currentPoll = resolve;
			}
		});
	}

	private clearPoll () {
		this.currentPoll!([]);
		this.currentPoll = undefined;
	}

	private clearQueue (): Event[] {
		let result = this.queue;
		this.queue = [];
		return result;
	}
}