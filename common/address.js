class Address {
	constructor (data) {
		if (data instanceof Address) {
			this._data = data.data.slice();
		} else if (Array.isArray(data)) {
			this._data = data;
		} else {
			throw "Invalid data to construct address";
		}
	}

	equals (addr) {
		if (this._data.length === addr.data.length) {
			let eq = true;
			for (let i=0; i<this._data.length; i++) {
				if (this._data[i] !== addr.data[i]) {
					eq = false;
					break;
				}
			}
			if (eq) return true;
		}

		return false;
	}

	clone () {
		return new Address(this._data.slice());
	}

	isParentOf (addr) {
		if (addr.data.length < this.data.length) return false;
		let result = true;
		for (let i=0; i<this.data.length; i++) {
			if (this.data[i] !== addr.data[i]) {
				result = false;
				break;
			}
		}
		return result;
	}

	print () {
		return "[" + this._data.join(", ") + "]";
	}

	toString () {
		return this._data.join(";");
	}

	static fromString (str) {
		let data = str.split(";");
		return new Address(data);
	}

	get data () {
		return this._data
	}

	set data (data) {
		this._data = data;
	}

	get parent () {
		return new Address(this._data.slice(0, this._data.length-1));
	}
}

module.exports = Address;