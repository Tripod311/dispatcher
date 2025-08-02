import { EventEmitter } from "events"
import { Socket } from "net"
import Log from "./log.js"

export default class JSONStreamProcessor extends EventEmitter {
	private socket: Socket;
	private remainder: string = "";
	private insideString: boolean = false;
	private bracketCounter: number = 0;
	private lookUpPointer: number = 0;
	private dataHandle: (chunk: Buffer) => void;
	
	constructor (socket: Socket) {
		super();

		this.socket = socket;
		this.dataHandle = this.onData.bind(this);
		this.socket.on("data", this.dataHandle);
	}

	destructor () {
		this.socket.off("data", this.dataHandle);

		this.removeAllListeners();
	}

	onData (chunk: Buffer) {
		this.remainder += chunk.toString();

		this.lookUp();
	}

	lookUp () {
		while (this.lookUpPointer < this.remainder.length) {
			if (this.insideString) {
				if (this.checkQuote()) {
					this.insideString = false;
				}

				this.lookUpPointer++;
			} else {
				let char = this.remainder[this.lookUpPointer];

				switch (char) {
					case '"':
						this.insideString = true;
						this.lookUpPointer++;
						break;
					case '{':
						this.bracketCounter++;
						this.lookUpPointer++;
						break;
					case '}':
						this.bracketCounter--;
						this.lookUpPointer++;

						if (this.bracketCounter === 0) {
							const messageText = this.remainder.slice(0, this.lookUpPointer);
							this.remainder = this.remainder.slice(this.lookUpPointer);
							this.lookUpPointer = 0;

							let message;
							try {
								message = JSON.parse(messageText);
							} catch (e) {
								Log.error(`Invalid json event\n${messageText}`, 0);
								return;
							}

							this.emit("message", message);
						}
						break;
					default:
						this.lookUpPointer++;
						break;
				}
			}
		}
	}

	checkQuote (): boolean {
		if (this.remainder[this.lookUpPointer] === '"') {
			let slashCounter = 0;
			let index = this.lookUpPointer-1;

			while (this.remainder[index] === '\\') {
				slashCounter++;
				index--;
			}

			return slashCounter % 2 === 0;
		} else {
			return false;
		}
	}
}