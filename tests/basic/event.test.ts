import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Event } from '../../src/common/event';
import Address from '../../src/common/address';
import type Dispatcher from '../../src/common/dispatcher';

describe('Event', () => {
	let dispatcher: Dispatcher;
	let sender: Address;
	let destination: Address;

	beforeEach(() => {
		dispatcher = {
			dispatch: vi.fn()
		} as unknown as Dispatcher;

		sender = new Address(['source']);
		destination = new Address(['dest']);
	});

	it('Event creation with minimal data', () => {
		const data = { command: 'ping' };
		const event = new Event(dispatcher, sender, destination, data);

		expect(event.sender).toBe(sender);
		expect(event.destination).toBe(destination);
		expect(event.data).toEqual(data);
		expect(event.isResponse).toBe(false);
		expect(event.trace).toBe(false);
	});

	it('Throw error if no command provided', () => {
		expect(() => {
			new Event(dispatcher, sender, destination, {} as any);
		}).toThrow('Command must be present in all events');
	});

	it('Call dispatcher.dispatch', () => {
		const data = { command: 'ping' };
		const event = new Event(dispatcher, sender, destination, data);
		event.dispatch(3);

		expect(dispatcher.dispatch).toHaveBeenCalledOnce();
		expect(dispatcher.dispatch).toHaveBeenCalledWith(destination, event, 3);
	});

	it('Correct response event', () => {
		const original = new Event(dispatcher, sender, destination, { command: 'do' });
		original.reqId = 42;
		const responseData = { command: 'done' };

		const dispatchSpy = vi.spyOn(original, 'dispatch');

		original.response(responseData);

		// будет вызван dispatch нового Event внутри response()
		expect(dispatcher.dispatch).toHaveBeenCalledOnce();
		const ev = (dispatcher.dispatch as any).mock.calls[0][1] as Event;

		expect(ev.isResponse).toBe(true);
		expect(ev.sender.equals(destination)).toBe(true);
		expect(ev.destination.equals(sender)).toBe(true);
		expect(ev.data.command).toBe('done');
		expect(ev.reqId).toBe(42);

		dispatchSpy.mockRestore();
	});

	it('captureTransfers returning ArrayBuffers', () => {
		const buffer1 = new ArrayBuffer(4);
		const buffer2 = new ArrayBuffer(8);

		const data = {
			command: 'transfer',
			payload: {
				nested: {
					buf: buffer1,
					list: [1, 2, buffer2]
				}
			}
		};

		const event = new Event(dispatcher, sender, destination, data);
		const transfers = event.captureTransfers();

		expect(transfers).toContain(buffer1);
		expect(transfers).toContain(buffer2);
		expect(transfers.length).toBe(2);
	});

	it('captureTransfers returns empty list', () => {
		const event = new Event(dispatcher, sender, destination, { command: 'noBuffers' });
		expect(event.captureTransfers()).toEqual([]);
	});
});