export default class Address {
	private _data: string[];

	constructor (data: string[] | Address) {
		if (data instanceof Address) {
			this._data = data.data.slice();
		} else if (Array.isArray(data)) {
			this._data = data;
		} else {
			throw new Error("Invalid data to construct address");
		}
	}

	equals (addr: Address): boolean {
		if (this._data.length !== addr.data.length) return false;
		for (let i = 0; i < this._data.length; i++) {
			if (this._data[i] !== addr.data[i]) return false;
		}
		return true;
	}

	clone (): Address {
		return new Address(this._data.slice());
	}

	isParentOf (addr: Address): boolean {
		if (addr.data.length < this._data.length) return false;
		let result = true;
		for (let i=0; i<this._data.length; i++) {
			if (this._data[i] !== addr.data[i]) {
				result = false;
				break;
			}
		}
		return result;
	}

	toString (): string {
		return "[" + this._data.join(", ") + "]";
	}

	get data (): string[] {
		return this._data
	}

	set data (data: string[]) {
		this._data = data;
	}

	get parent (): Address {
		return new Address(this._data.slice(0, this._data.length-1));
	}
}