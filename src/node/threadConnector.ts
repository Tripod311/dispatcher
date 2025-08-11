import { workerData, parentPort, MessagePort } from "worker_threads"
import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import Dispatcher from "../common/dispatcher.js"
import { Node } from "../common/node.js"
import Log from "../utils/log.js"

export default class ThreadConnector extends Node {
	private registered: boolean = false;
	private channel: MessagePort | null = null;
	private onChannelMessage: (msg: any) => void;

	constructor () {
		super ();

		Log.setLogLevel(workerData.logLevel);

		this.onChannelMessage = this.channelMessage.bind(this);

		parentPort!.once("message", (channel: MessagePort) => {
			this.channel = channel;
			this.channel.on("message", this.onChannelMessage);
		});
	}

	detach () {
		if (this.registered) {
			this.channel!.off("message", this.onChannelMessage);
			this.registered = false;
		}

		super.detach.call(this);
	}

	channelMessage (msg: any) {
		const ev = msg as SerializedEvent;

		switch (ev.data.command) {
			case "register":
				this.registered = true;
				const { address } = ev.data.data as { address: string[] };
				this.dispatcher = new Dispatcher();
				this.dispatcher.setRoot(this, new Address(address));
				break;
			case "ping":
				this.channel!.postMessage({
					sender: [],
					destination: [],
					data: { command: "pong" },
					trace: false,
					isResponse: true
				});
				break;
			case "terminate":
				this.dispatcher!.removeRoot();
				this.channel!.off("message", this.onChannelMessage);
				this.registered = false;
				break;
			default:
				if (this.registered) {
					const rev = new Event(this.dispatcher as Dispatcher, new Address(ev.sender), new Address(ev.destination), ev.data, ev.isResponse, ev.trace);
					rev.reqId = ev.reqId;
					rev.dispatch();
				} else {
					Log.warning("ThreadConnector received event before registration", 1);
				}
				break;
		}
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (this.address!.isParentOf(address)) {
			super.dispatch.call(this, address, this.address!.data.length, event);
		} else {
			this.channel!.postMessage({
				sender: event.sender.data,
				destination: event.destination.data,
				data: event.data,
				isResponse: event.isResponse,
				trace: event.trace,
				reqId: event.reqId
			});
		}
	}

	get isRegistered () {
		return this.registered;
	}
}