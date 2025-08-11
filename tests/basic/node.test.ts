import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node } from '../../src/common/node';
import Address from '../../src/common/address';
import { Event } from '../../src/common/event';
import type Dispatcher from '../../src/common/dispatcher';

describe('Node', () => {
	let node: Node;
	let mockDispatcher: Dispatcher;
	let rootAddress: Address;

	beforeEach(() => {
		node = new Node();
		mockDispatcher = {
			dispatch: vi.fn()
		} as unknown as Dispatcher;
		rootAddress = new Address(['root']);
		node.attach(mockDispatcher, rootAddress);
	});

	it('attach and address check', () => {
		expect(node.address).toEqual(rootAddress);
	});

	it('detach clears dispatcher, address and subNodes', () => {
		const child = new Node();
		const detachSpy = vi.spyOn(child, 'detach');
		node.addChild('child1', child);

		node.detach();

		expect(node.address).toBeNull();
		expect(detachSpy).toHaveBeenCalledOnce();
	});

	it('addChild creates subNode and calls attach', () => {
		const child = new Node();
		const attachSpy = vi.spyOn(child, 'attach');

		node.addChild('childA', child);

		expect(node.getChild('childA')).toBe(child);
		expect(attachSpy).toHaveBeenCalledWith(mockDispatcher, new Address(['root', 'childA']));
	});

	it('addChild calls warning twice', () => {
		const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const child = new Node();

		node.addChild('x', child);
		node.addChild('x', new Node());

		logSpy.mockRestore();
	});

	it('delChild deletes subNode', () => {
		const child = new Node();
		const detachSpy = vi.spyOn(child, 'detach');
		node.addChild('toRemove', child);

		node.delChild('toRemove');
		expect(node.getChild('toRemove')).toBeNull();
		expect(detachSpy).toHaveBeenCalledOnce();
	});

	it('send creates event and calls dispatcher.dispatch', () => {
		const data = { command: 'test' };
		const dst = ['x', 'y'];

		node.send(dst, data);

		expect(mockDispatcher.dispatch).toHaveBeenCalledOnce();
		const ev = (mockDispatcher.dispatch as any).mock.calls[0][1] as Event;
		expect(ev.data.command).toBe('test');
		expect(ev.sender.equals(rootAddress)).toBe(true);
		expect(ev.destination.equals(new Address(dst))).toBe(true);
	});

	it('send throws error on detached node', () => {
		const n = new Node();
		expect(() => n.send(['x'], { command: 'oops' })).toThrow("Calling send on detached node");
	});

	it('chain calls send and saves reqId', () => {
		const cb = vi.fn();
		const id = node.chain(['a', 'b'], { command: 'chainTest' }, cb);

		expect(typeof id).toBe('number');
		const ev = (mockDispatcher.dispatch as any).mock.calls[0][1] as Event;
		expect(ev.reqId).toBe(id);
	});

	it('clearChain deletes chain by id', () => {
		const id = node.chain(['x'], { command: 'x' }, vi.fn());
		node.clearChain(id);
		
		expect(node['chained'][id]).toBeUndefined();
	});

	it('clearChainByDestination deletes by destination', () => {
		const cb = vi.fn();
		node.chain(['some', 'dest'], { command: 'z' }, cb);
		node.chain(['some', 'other'], { command: 'y' }, cb);

		node.clearChainByDestination(['some', 'dest']);

		for (let key in node['chained']) {
			expect(node['chained'][key].destination.equals(new Address(['some', 'dest']))).toBe(false);
		}
	});

	it('setListener and removeListener working', () => {
		const fn = vi.fn();
		node.setListener('eventX', fn);

		const mockEvent = {
			data: { command: 'eventX' },
			sender: new Address(['a']),
			destination: rootAddress,
			isResponse: false,
			trace: false
		} as unknown as Event;

		node.handle(mockEvent);
		expect(fn).toHaveBeenCalledWith(mockEvent);

		node.removeListener('eventX');
		const fn2 = vi.fn();
		node.setListener('eventX', fn2);

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('handle uses chained callback if reqId matches', () => {
		const cb = vi.fn();
		const id = node.chain(['sender'], { command: 'ping' }, cb);

		const ev = {
			data: { command: 'ping' },
			sender: new Address(['sender']),
			destination: rootAddress,
			isResponse: true,
			trace: false,
			reqId: id
		} as unknown as Event;

		node.handle(ev);

		expect(cb).toHaveBeenCalledWith(ev);
		expect(node['chained'][id]).toBeUndefined();
	});

	it('defaultHandler logs when no listener exists', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ev = {
			data: { command: 'unhandled' },
			sender: new Address(['a']),
			destination: rootAddress,
			toString: () => '[a]',
			isResponse: false,
			trace: false
		} as unknown as Event;

		node.handle(ev);
		warn.mockRestore();
	});
});