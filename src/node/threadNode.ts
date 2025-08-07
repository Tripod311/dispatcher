import fs from "fs"
import { Worker, MessageChannel, MessagePort } from "worker_threads"
import Address from "../common/address.js"
import type { SerializedEvent } from "../common/event.js"
import { Event } from "../common/event.js"
import Dispatcher from "../common/dispatcher.js"
import { Node } from "../common/node.js"
import Log from "../utils/log.js"

export interface ThreadNodeOptions {
	interval: number;
	threshold: number;
	logLevel?: number;
}

export class ThreadNode extends Node {
	private connected: boolean = false;
	private script: string;
	private options: ThreadNodeOptions;
	private channel: MessagePort | null = null;
	private worker: Worker | null = null;
	private pingInterval: ReturnType<typeof setInterval> | undefined = undefined;
	private pingCounter: number = 0;

	constructor (script: string, options: ThreadNodeOptions) {
		super ();

		this.options = options;
		this.script = script;

		if (this.options.logLevel === undefined) {
			this.options.logLevel = Log.getLogLevel();
		}
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.worker = new Worker(this.script, {
			workerData: { logLevel: this.options.logLevel }
		});
		this.worker.on("error", this.onWorkerError.bind(this));

		const channel = new MessageChannel();
		this.channel = channel.port1;
		this.worker.postMessage(channel.port2, [channel.port2]);

		if (this.options.interval > 0) {
			this.pingInterval = setInterval(this.pingWorker.bind(this), this.options.interval);
		}

		this.channel.on("message", this.channelMessage.bind(this));
		this.channel.postMessage({
			sender: [],
			destination: [],
			data: {
				command: "register",
				data: {
					address: this.address!.data
				}
			}
		});

		this.connected = true;
	}

	detach () {
		if (this.connected) {
			this.channel!.postMessage({
				sender: [],
				destination: [],
				data: {
					command: "terminate"
				}
			});
			clearInterval(this.pingInterval);
		}

		super.detach();
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (this.connected) {
			this.channel!.postMessage({
				sender: event.sender.data,
				destination: event.destination.data,
				data: event.data,
				trace: event.trace,
				isResponse: event.isResponse
			});
		} else {
			Log.warning("ThreadNode received event before connected", 1);
		}
	}

	pingWorker () {
		if (this.pingCounter === this.options.threshold) {
			Log.warning("ThreadNode " + this.address!.toString() + " disconnected, worker ping failed", 1);
			this.connected = false;
			this.worker!.terminate();
			this.worker = null;
			this.channel = null;
			this.pingCounter = 0;
			clearInterval(this.pingInterval);
		} else {
			this.channel!.postMessage({
				sender: [],
				destination: [],
				data: {
					command: "ping"
				}
			});
			this.pingCounter++;
		}
	}

	channelMessage (msg: any) {
		const ev = msg as SerializedEvent;

		switch (ev.data.command) {
			case "pong":
				this.pingCounter = 0;
				break;
			default:
				const rev = new Event(this.dispatcher as Dispatcher, new Address(ev.sender), new Address(ev.destination), ev.data, ev.isResponse, ev.trace);
				rev.dispatch();
				break;
		}
	}

	onWorkerError (err: any) {
		Log.error("ThreadNode " + this.address!.toString() + " disconnected, worker error:\n" + err.toString(), 1);
		this.connected = false;
		this.worker!.terminate();
		this.worker = null;
		this.channel = null;
		this.pingCounter = 0;
		clearInterval(this.pingInterval);
	}

	get isConnected () {
		return this.connected;
	}
}