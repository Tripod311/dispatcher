const EventEmitter = require("events");
const Log = require("./log.js");

class JSONStreamProcessor extends EventEmitter {
	constructor (socket) {
		super();

		this.socket = socket;

		this.dataHandle = this.onData.bind(this);

		this.socket.on("data", this.dataHandle);

		this.remainder = "";
		this.insideString = false;
		this.bracketCounter = 0;
		this.lookUpPointer = 0;
	}

	destructor () {
		this.socket.off("data", this.dataHandle);

		super.removeAllListeners.call(this);
	}

	onData (chunk) {
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
							//emit message
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

	checkQuote () {
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

module.exports = JSONStreamProcessor;