import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"
import { Node } from "../common/node.js"
import Log from "../utils/log.js"

export default class HTTPConnector extends Node {
	private registered: boolean = false;
	private url: string;
	private pollTime: number;
	private keepAliveTime: number = -1;
	private pollTimeout: ReturnType<typeof setTimeout> | undefined;
	private keepAliveTimeout: ReturnType<typeof setTimeout> | undefined;

	constructor (url: string, pollTime: number) {
		super();

		this.url = url;
		this.pollTime = pollTime;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		fetch(this.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				sender: [],
				destination: [],
				data: {
					command: "register"
				}
			})
		}).then(this.onRegister.bind(this), this.onRegisterError.bind(this));
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
			fetch(this.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: event.serialize()
			}).then((response: Response) => {
				// do nothing
			}, (err: any) => {
				console.error("HTTPConnector dispatch error: " + err.toString());
			});
		}
	}

	async onRegister (response: Response) {
		const data = await response.json();

		this.registered = true;
		this._address = new Address(data.data.data.address as string[]);
		this.keepAliveTime = (data.data.data.sessionExpireTimeout as number) / 2;

		this.keepAliveTimeout = setTimeout(this.keepAlive.bind(this), this.keepAliveTime);
		this.pollTimeout = setTimeout(this.poll.bind(this), this.pollTime);

		Log.success("HTTPConnector registered: " + this.address!.toString(), 1);
	}

	onRegisterError (err: any) {
		console.error("HTTPConnector registration error: " + err.toString());
	}

	async keepAlive () {
		try {
			await fetch(this.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					sender: this.address!.data,
					destination: [],
					data: {
						command: "keepAlive"
					}
				})
			});

			Log.success("HTTPConnector keepAlive", 4);

			this.keepAliveTimeout = setTimeout(this.keepAlive.bind(this), this.keepAliveTime);
		} catch (err: any) {
			Log.error("HTTPConnector keepAlive error: " + err.toString(), 1);
		}
	}

	async poll () {
		try {
			const response = await fetch(this.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					sender: this.address!.data,
					destination: [],
					data: {
						command: "poll"
					}
				})
			});

			const data = await response.json();

			const eventQueue = data.data.data.events as SerializedEvent[];

			for (let i=0; i<eventQueue.length; i++) {
				const raw = eventQueue[i];
				const ev = new Event(this.dispatcher as Dispatcher, new Address(raw.sender), new Address(raw.destination), raw.data, raw.isResponse, raw.trace);
				ev.reqId = raw.reqId;

				ev.dispatch();
			}

			this.pollTimeout = setTimeout(this.poll.bind(this), this.pollTime);

			Log.success("HTTPConnector poll returned " + eventQueue.length + " events", 4);
		} catch (err: any) {
			Log.error("HTTPConnector poll error: " + err.toString(), 1);
		}
	}

	get isRegistered () {
		return this.registered;
	}
}