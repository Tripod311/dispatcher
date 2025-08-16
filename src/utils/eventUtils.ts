import Address from "../common/address.js"
import { Event } from "../common/event.js"
import type Dispatcher from "../common/dispatcher.js"

const BINARY_MARKER_REGEXP = /^##BINARY_(\d+)_(\d+)##$/;
const sharedEncoder = new TextEncoder();
const sharedDecoder = new TextDecoder();

function extractBinary (data: any, binary: Uint8Array[]): any {
	if (data instanceof Uint8Array) {
		const offset = binary.reduce((acc, val) => acc + val.length, 0);
		binary.push(data);
		return `##BINARY_${offset}_${data.length}##`;
	} else if (Array.isArray(data)) {
		return (data as any[]).map(obj => {
			return extractBinary(obj, binary);
		});
	} else if (typeof data === "object" && data !== null) {
		const result: Record<string, any> = {};

		for (const key in data as Record<string, any>) {
			result[key] = extractBinary(data[key], binary);
		}

		return result;
	} else {
		return data;
	}
}

function restoreBinary (data: any, binary: Uint8Array): any {
	if (typeof data === "string") {
		const match = data.match(BINARY_MARKER_REGEXP);
		if (match && match[1] && match[2]) {
			const offset = parseInt(match[1], 10);
			const length = parseInt(match[2], 10);

			return binary.subarray(offset, offset + length);
		} else {
			return data;
		}
	} else if (Array.isArray(data)) {
		return (data as any[]).map(obj => {
			return restoreBinary(obj, binary);
		});
	} else if (typeof data === "object" && data !== null) {
		const result: Record<string, any> = {};

		for (const key in data as Record<string, any>) {
			result[key] = restoreBinary(data[key], binary);
		}

		return result;
	} else {
		return data;
	}
}

export function serialize (event: Event) {
	const binary: Uint8Array[] = [];

	const metaData = {
		sender: event.sender.data,
		destination: event.destination.data,
		data: event.data,
		isResponse: event.isResponse,
		trace: event.trace,
		reqId: event.reqId
	};

	const processedData = extractBinary(metaData, binary);

	const meta = sharedEncoder.encode(JSON.stringify(processedData));

	const binLength = binary.reduce((acc, val) => acc + val.length, 0);
	const binTotal = new Uint8Array(binLength);
	let binOffset = 0;
	for (const chunk of binary) {
		binTotal.set(chunk, binOffset);
		binOffset += chunk.length;
	}

	const metaLength = meta.length;
	const totalLength = 4 + metaLength + 4 + binLength;
	const buf = new Uint8Array(4 + totalLength);

	const view = new DataView(buf.buffer);
	let offset = 0;

	view.setUint32(offset, buf.length);
	offset += 4;

	view.setUint32(offset, metaLength);
	offset += 4;

	buf.set(meta, offset);
	offset += metaLength;

	view.setUint32(offset, binLength);
	offset += 4;

	buf.set(binTotal, offset);

	return buf;
}

export function deserialize (dispatcher: Dispatcher, buf: Uint8Array): Event {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	let offset = 0;

	const totalLength = view.getUint32(offset);
	offset += 4;

	if (totalLength !== buf.length) {
		throw new Error(`Invalid packet length: expected ${totalLength}, got ${buf.length}`);
	}

	const metaLength = view.getUint32(offset);
	offset += 4;

	const metaBytes = buf.subarray(offset, offset + metaLength);
	offset += metaLength;

	const metaStr = sharedDecoder.decode(metaBytes);
	const meta = JSON.parse(metaStr);

	const binLength = view.getUint32(offset);
	offset += 4;

	const binary = buf.subarray(offset, offset + binLength);

	// restore event
	const restored = restoreBinary(meta, binary);

	const result = new Event(
		dispatcher,
		new Address(restored.sender as string[]),
		new Address(restored.destination as string[]),
		restored.data,
		restored.isResponse,
		restored.trace
	);
	result.reqId = restored.reqId;
	
	return result;
}

export function deserializeSequence (dispatcher: Dispatcher, buf: Uint8Array): Event[] {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const result: Event[] = [];

	let offset = 0;

	while (offset < buf.length) {
		let packageLength = view.getUint32(offset);

		const event = deserialize(dispatcher, buf.subarray(offset, offset + packageLength));
		result.push(event);

		offset += packageLength;
	}

	return result;
}