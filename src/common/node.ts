import Address from "./address.js"
import type { EventData } from "./event.js"
import { Event} from "./event.js"
import type Dispatcher from "./dispatcher.js"
import Log from "../utils/log.js"

interface ChainedEvent {
	callback: NodeListener;
	destination: Address;
}

export type NodeListener = (ev: Event) => void;

export class Node {
	private dispatcher: Dispatcher | null;
	private _address: Address | null;
	private subNodes: Record<string, Node> = {};
	private requestCounter: number = 0;
	private chained: Record<number, ChainedEvent> = {};
	private listeners: Record<string, NodeListener> = {};

	constructor () {
		this.dispatcher = null;
		this._address = null;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		this.dispatcher = dispatcher;
		this._address = address;
	}

	detach () {
		this.listeners = {};
		this.dispatcher = null;
		this._address = null;
		for (let i in this.subNodes) {
			this.subNodes[i]?.detach();
		}
	}

	addChild (id: string, n: Node) {
		if (this.address === null) throw new Error("Calling addChild on detached node");

		let address = this._address!.data;
		address.push(id);

		if (this.subNodes[id]) {
			Log.warning(this._address!.toString() + " :: Node " + id + " already exists", 2);
		} else {
			this.subNodes[id] = n;
			n.attach(this.dispatcher!, new Address(address));
		}
	}

	delChild (id: string) {
		if (this.address === null) throw new Error("Calling delChild on detached node");

		if (this.subNodes[id] === undefined) {
			Log.warning(this._address!.toString() + " :: Node " + id + " doesn't exist", 2);
		} else {
			this.subNodes[id].detach();
			delete this.subNodes[id];
		}
	}

	getChild (id: string): Node | null {
		return this.subNodes[id] || null;
	}

	dispatch (address: Address, hopIndex: number, event: Event) {
		if (hopIndex === address.data.length) {
			if (event.trace) {
				Log.info(`EVENT TRACE: ${event.data.command} HANDLING AT [${address.data.join(',')}]`, 4);
			}
			this.handle(event);
		} else {
			let id = address.data[hopIndex] as string;

			if (this.subNodes[id]) {
				if (event.trace) {
					Log.info(`EVENT TRACE: ${event.data.command} PASSING AT [${address.data.slice(0,hopIndex).join(',')}]`, 4);
				}
				this.subNodes[id].dispatch(address, hopIndex + 1, event);
			} else {
				if (event.trace) {
					Log.info(`EVENT TRACE: ${event.data.command} STUCK AT [${address.data.slice(0,hopIndex).join(',')}]`, 4);
				}
				this.destinationUnreached(event);
			}
		}
	}

	destinationUnreached (event: Event) {
		if (event.isResponse) {
			Log.warning("Node " + event.destination.toString() + " is not present", 2);
		} else {
			const responseData: EventData = {
				command: event.data.command + "Response",
				error: true,
				details: "Node " + event.destination.toString() + " is not present"
			};

			if (event.data.reqId) {
				responseData.reqId = event.data.reqId;
			}
			event.response(responseData);
		}
	}

	handle (event: Event) {
		const reqId = event.data.reqId;
		const chainEntry = reqId !== undefined ? this.chained[reqId] : undefined;

		if (reqId !== undefined && chainEntry !== undefined && chainEntry.destination.equals(event.sender)) {
			chainEntry.callback(event);
			delete this.chained[reqId];
		} else {
			if (this.listeners[event.data.command] !== undefined) {
				this.listeners[event.data.command](event);
			} else {
				this.defaultHandler(event);
			}
		}
	}

	defaultHandler (event: Event) {
		if (this._address) {
			Log.warning(this._address.toString() + " :: DEFAULT HANDLER - \n" + JSON.stringify(event.data), 2);
		} else {
			Log.warning("Detached node received event\n" + JSON.stringify({
				sender: event.sender.toString(),
				destination: event.destination.toString(),
				data: event.data
			}), 2);
		}
	}

	send (destination: Address | string[], data: EventData, trace: boolean = false) {
		if (this.dispatcher === null) throw new Error("Calling send on detached node");

		let ev = new Event(this.dispatcher as Dispatcher, this._address as Address, new Address(destination), data, false, trace);
		ev.dispatch();
	}

	chain (destination: Address | string[], data: EventData, callback: NodeListener, trace: boolean = false) {
		let id = this.requestCounter++;
		
		this.chained[id] = {
			callback: callback,
			destination: new Address(destination)
		}

		data.reqId = id;

		this.send(destination, data, trace);

		return id;
	}

	clearChain (id: number) {
		delete this.chained[id];
	}

	clearChainByDestination (destination: Address | string[]) {
		const dstAddr = new Address(destination);

		for (let i in this.chained) {
			if (this.chained[i].destination.equals(dstAddr)) {
				this.clearChain(parseInt(i));
			}
		}
	}

	setListener (command: string, fn: NodeListener) {
		this.listeners[command] = fn;
	}

	removeListener (command: string) {
		delete this.listeners[command];
	}

	get address () {
		return this._address;
	}
}