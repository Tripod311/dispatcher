import { EventEmitter } from "events"
import { Socket } from "net"
import type Dispatcher from "../common/dispatcher.js"
import { deserialize } from "./eventUtils.js"
import Log from "./log.js"

export default class StreamProcessor extends EventEmitter {
	private dispatcher: Dispatcher;
	private socket: Socket;
	private dataHandle: (chunk: Buffer) => void;
	private unprocessed: Buffer = Buffer.alloc(0);
	
	constructor (dispatcher: Dispatcher, socket: Socket, unprocessed?: Buffer) {
		super();

		this.dispatcher = dispatcher;
		this.socket = socket;
		if (unprocessed) this.unprocessed = unprocessed;
		this.dataHandle = this.onData.bind(this);
		this.socket.on("data", this.dataHandle);
	}

	destructor () {
		this.socket.off("data", this.dataHandle);

		this.removeAllListeners();
	}

	onData (chunk: Buffer) {
		this.unprocessed = Buffer.concat([this.unprocessed, chunk]);

		this.read();
	}

	read () {
		if (this.unprocessed.length < 4) return;

		let packageLength = this.unprocessed.readUint32BE(0);

		while (packageLength <= this.unprocessed!.length) {
			try {
				const event = deserialize(this.dispatcher, this.unprocessed.subarray(0, packageLength));
				this.emit("message", event);
			} catch (err: any) {
				Log.error("StreamProcessor error, can't process package", 2);
			}

			this.unprocessed = this.unprocessed.subarray(packageLength);

			if (this.unprocessed.length > 4) {
				packageLength = this.unprocessed.readUint32BE(0);
			} else {
				break;
			}
		}
	}
}