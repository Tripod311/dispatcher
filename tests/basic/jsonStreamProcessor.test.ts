import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import Dispatcher from "../../src/common/dispatcher";
import JSONStreamProcessor from '../../src/utils/jsonStreamProcessor';

describe('JSONStreamProcessor', () => {
	let dispatcher: Dispatcher;
	let fakeSocket: EventEmitter;
	let processor: JSONStreamProcessor;

	beforeEach(() => {
		dispatcher = new Dispatcher();
		fakeSocket = new EventEmitter();
		processor = new JSONStreamProcessor(dispatcher, fakeSocket);
	});

	it('parsing single JSON', async () => {
		const ev = {
			sender: ["a", "b"],
			destination: ["a", "c"],
			data: {
				command: "call",
				data: {
					a: 1,
					b: 2
				}
			},
			isResponse: false,
			trace: false,
			reqId: 1
		};

		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from(JSON.stringify(ev)));
		});
		
		expect(msg.sender.data).toEqual(ev.sender);
		expect(msg.destination.data).toEqual(ev.destination);
		expect(msg.data).toEqual(ev.data);
		expect(msg.isResponse).toEqual(ev.isResponse);
		expect(msg.trace).toEqual(ev.trace);
		expect(msg.reqId).toEqual(ev.reqId);
	});

	it('parsing two events in one chunk', () => {
		const ev1 = {
			sender: ["a", "b"],
			destination: ["a", "c"],
			data: {
				command: "call",
				data: {
					a: 1,
					b: 2
				}
			},
			isResponse: false,
			trace: false,
			reqId: 1
		};
		const ev2 = {
			sender: ["c", "d"],
			destination: ["d", "c"],
			data: {
				command: "call",
				data: {
					d: 1,
					c: 2
				}
			},
			isResponse: true,
			trace: true,
			reqId: 42
		};

		const spy = vi.fn();
		processor.on('message', spy);
		let seq = [];
		processor.on('message', (event) => {seq.push(event)});

		fakeSocket.emit('data', Buffer.from(JSON.stringify(ev1) + JSON.stringify(ev2)));

		expect(spy).toHaveBeenCalledTimes(2);

		expect(seq[0].sender.data).toEqual(ev1.sender);
		expect(seq[0].destination.data).toEqual(ev1.destination);
		expect(seq[0].data).toEqual(ev1.data);
		expect(seq[0].isResponse).toEqual(ev1.isResponse);
		expect(seq[0].trace).toEqual(ev1.trace);
		expect(seq[0].reqId).toEqual(ev1.reqId);

		expect(seq[1].sender.data).toEqual(ev2.sender);
		expect(seq[1].destination.data).toEqual(ev2.destination);
		expect(seq[1].data).toEqual(ev2.data);
		expect(seq[1].isResponse).toEqual(ev2.isResponse);
		expect(seq[1].trace).toEqual(ev2.trace);
		expect(seq[1].reqId).toEqual(ev2.reqId);
	});

	it('parse json from two chunks', async () => {
		const ev = {
			sender: ["a", "b"],
			destination: ["a", "c"],
			data: {
				command: "call",
				data: {
					a: 1,
					b: 2
				}
			},
			isResponse: false,
			trace: false,
			reqId: 1
		};
		const evString = JSON.stringify(ev);
		const chunk1 = evString.slice(0, 5);
		const chunk2 = evString.slice(5);

		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from(chunk1));
			fakeSocket.emit('data', Buffer.from(chunk2));
		});

		expect(msg.sender.data).toEqual(ev.sender);
		expect(msg.destination.data).toEqual(ev.destination);
		expect(msg.data).toEqual(ev.data);
		expect(msg.isResponse).toEqual(ev.isResponse);
		expect(msg.trace).toEqual(ev.trace);
		expect(msg.reqId).toEqual(ev.reqId);
	});

	it('ignore brackets inside strings', async () => {
		const ev = {
			sender: ["a", "b"],
			destination: ["a", "c"],
			data: {
				command: "call",
				data: {
					a: "value { with } brackets"
				}
			},
			isResponse: false,
			trace: false,
			reqId: 1
		};

		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from(JSON.stringify(ev)));
		});

		expect(msg.sender.data).toEqual(ev.sender);
		expect(msg.destination.data).toEqual(ev.destination);
		expect(msg.data).toEqual(ev.data);
		expect(msg.isResponse).toEqual(ev.isResponse);
		expect(msg.trace).toEqual(ev.trace);
		expect(msg.reqId).toEqual(ev.reqId);
	});

	it('ignore escaped brackets', async () => {
		const ev = {
			sender: ["a", "b"],
			destination: ["a", "c"],
			data: {
				command: "call",
				data: {
					a: "He said: \"hello\""
				}
			},
			isResponse: false,
			trace: false,
			reqId: 1
		};

		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from(JSON.stringify(ev)));
		});

		expect(msg.sender.data).toEqual(ev.sender);
		expect(msg.destination.data).toEqual(ev.destination);
		expect(msg.data).toEqual(ev.data);
		expect(msg.isResponse).toEqual(ev.isResponse);
		expect(msg.trace).toEqual(ev.trace);
		expect(msg.reqId).toEqual(ev.reqId);
	});

	it('invalid json logs error', () => {
		const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const emitSpy = vi.fn();
		processor.on('message', emitSpy);

		fakeSocket.emit('data', Buffer.from('{"broken": true'));

		expect(emitSpy).not.toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it('destructor() removes listeners', () => {
		const removeSpy = vi.spyOn(fakeSocket, 'off');

		processor.destructor();

		expect(removeSpy).toHaveBeenCalledWith('data', expect.any(Function));
	});
});