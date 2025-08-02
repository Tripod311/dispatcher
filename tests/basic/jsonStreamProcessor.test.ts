import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import JSONStreamProcessor from '../../src/utils/jsonStreamProcessor';

describe('JSONStreamProcessor', () => {
	let fakeSocket: EventEmitter;
	let processor: JSONStreamProcessor;

	beforeEach(() => {
		fakeSocket = new EventEmitter();
		processor = new JSONStreamProcessor(fakeSocket);
	});

	it('parsing single JSON', async () => {
		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from('{"a":1}'));
		});
		expect(msg).toEqual({ a: 1 });
	});

	it('parsing two json objects in one chunk', () => {
		const spy = vi.fn();
		processor.on('message', spy);

		fakeSocket.emit('data', Buffer.from('{"x":1}{"y":2}'));

		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenCalledWith({ x: 1 });
		expect(spy).toHaveBeenCalledWith({ y: 2 });
	});

	it('parse json from two chunks', async () => {
		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from('{"name":'));
			fakeSocket.emit('data', Buffer.from('"test"}'));
		});

		expect(msg).toEqual({ name: 'test' });
	});

	it('ignore brackets inside strings', async () => {
		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from('{"str":"value { with } brackets"}'));
		});

		expect(msg).toEqual({ str: 'value { with } brackets' });
	});

	it('ignore escaped brackets', async () => {
		const msg = await new Promise((resolve) => {
			processor.on('message', resolve);
			fakeSocket.emit('data', Buffer.from('{"text":"He said: \\"hello\\""}'));
		});

		expect(msg).toEqual({ text: 'He said: "hello"' });
	});

	it('invalid json logs error', () => {
		const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const emitSpy = vi.fn();
		processor.on('message', emitSpy);

		fakeSocket.emit('data', Buffer.from('{"broken": true')); // нет закрытия

		expect(emitSpy).not.toHaveBeenCalled();
		logSpy.mockRestore();
	});

	it('destructor() removes listeners', () => {
		const removeSpy = vi.spyOn(fakeSocket, 'off');

		processor.destructor();

		expect(removeSpy).toHaveBeenCalledWith('data', expect.any(Function));
	});
});