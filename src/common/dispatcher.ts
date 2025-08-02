import Address from "./address.js"
import { Node } from "./node.js"
import { Event } from "./event.js"

const PendingTimeout = 10000;

export default class Dispatcher {
	private _root: Node | null = null;
	private lock: ReturnType<typeof setTimeout> | undefined = undefined;

	setRoot (root: Node, address: Address) {
		this._root = root;
		this._root.attach(this, address);
		this.lock = setTimeout(this.loop.bind(this), PendingTimeout);
	}

	get root () {
		return this._root;
	}

	removeRoot () {
		if (this._root) {
			this._root.detach();
			this._root = null;
		}
		clearTimeout(this.lock);
		this.lock = undefined;
	}

	dispatch (destination: Address, event: Event, hop: number) {
		if (this._root !== null) {
			this._root.dispatch(destination, hop || 1, event);
		}
	}

	loop () {
		this.lock = setTimeout(this.loop.bind(this), PendingTimeout);
	}
}