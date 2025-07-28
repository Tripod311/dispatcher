function lookUpBuffers (obj, arr) {
	if (Array.isArray(obj)) {
		for (let i=0; i<obj.length; i++) {
			if (obj[i] instanceof ArrayBuffer) {
				arr.push(obj[i]);
			} else if (Array.isArray(obj[i]) || (obj[i] !== null && typeof obj[i] === 'object')) {
				lookUpBuffers(obj[i],arr);
			}
		}
	} else {
		for (let i in obj) {
			if (obj[i] instanceof ArrayBuffer) {
				arr.push(obj[i]);
			} else if (Array.isArray(obj[i]) || (obj[i] !== null && typeof obj[i] === 'object')) {
				lookUpBuffers(obj[i],arr);
			}
		}
	}
}

class Event {
	constructor (dispatcher, sender, destination, data, isResponse, trace) {
		if (!data.command) {
			throw new Error("Command must be present in all events");
		}
		this.dispatcher = dispatcher;
		this.sender = sender;
		this.destination = destination;
		this.data = data;
		this.isResponse = isResponse || false;
		this.trace = trace || false;
	}

	serialize () {
		return JSON.stringify({
			sender: this.sender.data,
			destination: this.destination.data,
			data: this.data,
			isResponse: this.isResponse,
			trace: this.trace
		});
	}

	dispatch (hop) {
		this.dispatcher.dispatch(this.destination, this, hop);
	}

	response (obj) {
		if (this.data.reqId !== undefined) obj.reqId = this.data.reqId;
		let ev = new Event(this.dispatcher, this.destination, this.sender, obj, true, false);
		ev.dispatch();
	}

	captureTransfers () {
		let result = [];

		lookUpBuffers(this.data, result);

		return result;
	}

	static deserialize (dispatcher, str) {
		let ds = JSON.parse(str);

		return new Event(dispatcher, ds.sender, ds.destination, ds.data, ds.isResponse || false, ds.trace || false);
	}
}

module.exports = Event;