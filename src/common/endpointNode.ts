import Address from "./address.js"
import { Node } from "./node.js"
import Restrictions from "./restrictions.js"
import ConnectionNode from "./connectionNode.js"

export default class EndpointNode extends Node {
	public restrictions: Restrictions;

	constructor (addresses?: Address[] | Set<Address>) {
		super();

		this.restrictions = new Restrictions(addresses);
	}

	addChild (id: string, n: ConnectionNode) {
		n.setRestrictions(this.restrictions.clone());

		super.addChild(id, n);
	}
}