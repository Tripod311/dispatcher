import Address from "./address.js"
import { Event } from "./event.js"
import { Node } from "./node.js"
import type Dispatcher from "./dispatcher.js"
import Restrictions from "./restrictions.js"
import Log from "../utils/log.js"

export default class ConnectionNode extends Node {
	public restrictions: Restrictions = new Restrictions();

	setRestrictions (restrictions: Restrictions) {
		this.restrictions = restrictions;
	}

	attach (dispatcher: Dispatcher, address: Address) {
		super.attach(dispatcher, address);

		this.restrictions.add(this.address!);
	}
}