import { EventEmitter } from "events"
import { Socket } from "net"
import type Dispatcher from "../common/dispatcher.js"
import { deserialize } from "./eventUtils.js"
import Log from "./log.js"

export default class StreamProcessor extends EventEmitter {
	private dispatcher: Dispatcher;
	private socket: Socket;
	private dataHandle: (chunk: Buffer) => void;
	private unprocessed: Buffer[] = [];
	private unprocessedLength: number = 0;
	
	constructor (dispatcher: Dispatcher, socket: Socket) {
		super();

		this.dispatcher = dispatcher;
		this.socket = socket;
		this.dataHandle = this.onData.bind(this);
		this.socket.on("data", this.dataHandle);
	}

	destructor () {
		this.socket.off("data", this.dataHandle);

		this.removeAllListeners();
	}

	onData (chunk: Buffer) {
		this.unprocessed.push(chunk);
		this.unprocessedLength += chunk.length;

		this.read();
	}

	readHeader (): number {
		while (this.unprocessed[0].length < 4 && this.unprocessed.length > 1) {
			this.unprocessed[0] = Buffer.concat([this.unprocessed[0], this.unprocessed[1]]);
			this.unprocessed.splice(1, 1);
		}

		return this.unprocessed[0].readUint32LE(0);
	}

	collectPacket (length: number): Buffer {
		const resArr: Buffer[] = [];

		let copied = 0;

		while (copied < length) {
			const toCopy = length - copied;

			if (this.unprocessed[0].length <= toCopy) {
				const chunk = this.unprocessed.shift();
				resArr.push(chunk!);
				copied += chunk!.length;
			} else {
				const packetPart = this.unprocessed[0].subarray(0, toCopy);
				resArr.push(packetPart);
				this.unprocessed[0] = this.unprocessed[0].subarray(toCopy);

				copied += packetPart.length;
			}
		}

		return Buffer.concat(resArr);
	}

	read () {
		while (this.unprocessedLength >= 4) {
			const pl = this.readHeader();

			if (this.unprocessedLength >= pl) {
				try {
					const event = deserialize(this.dispatcher, this.collectPacket(pl));
					this.emit("message", event);
				} catch (err: any) {
					Log.error("StreamProcessor error, can't process package: " + err.toString(), 2);
				}

				this.unprocessedLength -= pl;
			} else {
				break;
			}
		}
	}
}