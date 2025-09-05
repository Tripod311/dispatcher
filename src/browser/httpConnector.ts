import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import { Node } from "../common/node.js"
import Log from "../utils/log.js"
import { serialize, deserializeSequence } from "../utils/eventUtils.js"

export default class HTTPConnector extends Node {
	private registered: boolean = false;
	private url: string;
	private pollTime: number;
	private keepAliveTime: number = -1;
	private pollTimeout: ReturnType<typeof setTimeout> | undefined;
	private keepAliveTimeout: ReturnType<typeof setTimeout> | undefined;
	public readyPromise?: Promise<void>;
	private readyResolve?: () => void;
	private readyReject?: (err: any) => void;

	constructor (url: string, pollTime: number) {
		super();

		this.url = url;
		this.pollTime = pollTime;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.readyPromise = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});

		const ev = new Event(this.dispatcher as Dispatcher, new Address([]), new Address([]), {
			command: "register"
		});
		this.sendEvent(ev).then(this.onRegister.bind(this), this.onRegisterError.bind(this));
	}

	detach () {
		clearTimeout(this.pollTimeout);
		clearTimeout(this.keepAliveTimeout);

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (this.address!.equals(address) || this.address!.isParentOf(address)) {
			super.dispatch(address, this.address!.data.length, event);
		} else {
			this.sendEvent(event);
		}
	}

	async onRegister (events: Event[]) {
		const event = events[0]

		if (event.data.command === "error") {
			this.onRegisterError(event.data.data.details);
		} else {
			this.registered = true;
			this._address = new Address(event.data.data.address as string[]);
			this.keepAliveTime = (event.data.data.sessionExpireTimeout as number) / 2;

			this.keepAliveTimeout = setTimeout(this.keepAlive.bind(this), this.keepAliveTime);
			this.pollTimeout = setTimeout(this.poll.bind(this), this.pollTime);

			Log.success("HTTPConnector registered: " + this.address!.toString(), 1);
			this.readyResolve!();
			this.readyResolve = undefined;
			this.readyReject = undefined;
		}
	}

	onRegisterError (err: any) {
		console.error("HTTPConnector registration error: " + err.toString());

		this.readyReject!(err);
		this.readyResolve = undefined;
		this.readyReject = undefined;
	}

	async keepAlive () {
		try {
			const event = new Event(this.dispatcher as Dispatcher, new Address(this.address as Address), new Address([]), {
				command: "keepAlive"
			});

			const rsEvent = (await this.sendEvent(event))[0];

			if (rsEvent.data.command === "error") {
				throw new Error(rsEvent.data.data.details);
			}

			Log.success("HTTPConnector keepAlive", 4);

			this.keepAliveTimeout = setTimeout(this.keepAlive.bind(this), this.keepAliveTime);
		} catch (err: any) {
			Log.error("HTTPConnector keepAlive error: " + err.toString(), 1);
		}
	}

	async poll () {
		try {
			const event = new Event(this.dispatcher as Dispatcher, new Address(this.address as Address), new Address([]), {
				command: "poll"
			});

			const queue = await this.sendEvent(event);

			for (const event of queue) {
				event.dispatch();
			}

			this.pollTimeout = setTimeout(this.poll.bind(this), this.pollTime);

			Log.success("HTTPConnector poll returned " + queue.length + " events", 4);
		} catch (err: any) {
			Log.error("HTTPConnector poll error: " + err.toString(), 1);
		}
	}

	async sendEvent (event: Event): Promise<Event[]> {
		const body = serialize(event);

		const response = await fetch(this.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Length": body.length.toString()
			},
			body: body
		});

		const bytes = await response.bytes();

		return deserializeSequence(this.dispatcher as Dispatcher, bytes);
	}

	get isRegistered () {
		return this.registered;
	}
}