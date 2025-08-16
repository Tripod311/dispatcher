import Address from "./address.js"

export default class Restrictions {
	private allowedAddresses: Set<Address> = new Set();

	constructor (addresses?: Address[] | Set<Address>) {
		if (addresses) {
			this.allowedAddresses = new Set(addresses);
		}
	}

	add (address: Address) {
		const toSplice: Set<Address> = new Set();

		for (let resAddr of this.allowedAddresses) {
			if (address.equals(resAddr) || resAddr.isParentOf(address)) return;

			if (address.isParentOf(resAddr)) {
				toSplice.add(resAddr);
			}
		}

		for (let rmAddr of toSplice) {
			this.allowedAddresses.delete(rmAddr);
		}

		this.allowedAddresses.add(address);
	}

	remove (address: Address) {
		const toSplice: Set<Address> = new Set();

		for (let resAddr of this.allowedAddresses) {
			if (address.equals(resAddr) || address.isParentOf(resAddr)) toSplice.add(resAddr);
		}

		for (let rmAddr of toSplice) {
			this.allowedAddresses.delete(rmAddr);
		}
	}

	check (address: Address): boolean {
		for (let resAddr of this.allowedAddresses) {
			if (resAddr.equals(address) || resAddr.isParentOf(address)) return true;
		}

		return false;
	}

	clear () {
		this.allowedAddresses.clear();
	}

	clone () {
		return new Restrictions(new Set(this.allowedAddresses));
	}
}