import Address from "./address.js"
import type { EventData } from "./event.js"
import { Event } from './event.js'
import { Node } from "./node.js"
import Dispatcher from "./dispatcher.js"

export default class Subscribable extends Node {
	private subscribers: Address[] = [];

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.setListener("subscribe", this.subscribe.bind(this));
		this.setListener("unsubscribe", this.unsubscribe.bind(this));
	}

	subscribe (event: Event) {
		for (let i=0; i<this.subscribers.length; i++) {
			if (this.subscribers[i].equals(event.sender)) return;
		}

		this.subscribers.push(event.sender);
	}

	unsubscribe (event: Event) {
		for (let i=0; i<this.subscribers.length; i++) {
			if (this.subscribers[i].equals(event.sender)) {
				this.subscribers.splice(i, 1);
				return;
			}
		}
	}

	notify (data: EventData, except: Address[]) {
		for (let i=0; i<this.subscribers.length; i++) {
			let skip = false;

			for (let j=0; j<except.length; j++) {
				if (this.subscribers[i].equals(except[j])) {
					skip = true;
					break;
				}
			}

			if (!skip) {
				this.send(this.subscribers[i], data);
			}
		}
	}
}