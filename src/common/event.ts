import Address from "./address.js"
import type Dispatcher from "./dispatcher.js"

function lookUpBuffers (obj: any, arr: any[]) {
	if (Array.isArray(obj)) {
		for (let i=0; i<obj.length; i++) {
			if (obj[i] instanceof ArrayBuffer) {
				arr.push(obj[i]);
			} else if (Array.isArray(obj[i]) || (obj[i] !== null && typeof obj[i] === 'object')) {
				lookUpBuffers(obj[i], arr);
			}
		}
	} else {
		for (let i in obj) {
			if (obj[i] instanceof ArrayBuffer) {
				arr.push(obj[i]);
			} else if (Array.isArray(obj[i]) || (obj[i] !== null && typeof obj[i] === 'object')) {
				lookUpBuffers(obj[i], arr);
			}
		}
	}
}

export interface EventData {
	command: string;
	error?: boolean;
	details?: string;
	data?: any;
	reqId?: number;
}

export interface SerializedEvent {
	sender: string[];
	destination: string[];
	data: EventData;
	trace?: boolean;
	isResponse?: boolean;
	reqId?: number;
}

export class Event {
	private dispatcher: Dispatcher;
	public sender: Address;
	public destination: Address;
	public data: EventData;
	public isResponse: boolean = false;
	public trace: boolean = false;
	public reqId: number | undefined;

	constructor (dispatcher: Dispatcher, sender: Address, destination: Address, data: EventData, isResponse: boolean = false, trace: boolean = false) {
		if (!data.command) {
			throw new Error("Command must be present in all events");
		}
		this.dispatcher = dispatcher;
		this.sender = sender;
		this.destination = destination;
		this.data = data;
		this.isResponse = isResponse;
		this.trace = trace;
	}

	dispatch (hop: number = 0) {
		this.dispatcher.dispatch(this.destination, this, hop);
	}

	response (obj: EventData) {
		let ev = new Event(this.dispatcher, this.destination, this.sender, obj, true, false);
		if (this.reqId !== undefined) ev.reqId = this.reqId;
		ev.dispatch();
	}

	captureTransfers (): any[] {
		let result: any[] = [];

		lookUpBuffers(this.data, result);

		return result;
	}
}