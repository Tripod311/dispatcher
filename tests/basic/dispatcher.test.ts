import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dispatcher from '../../src/common/dispatcher.ts';
import Address from '../../src/common/address.ts';
import { Node } from '../../src/common/node.ts';

describe('Dispatcher', () => {
	let dispatcher: Dispatcher;
	let mockNode: Node;
	let mockAddress: Address;

	beforeEach(() => {
		dispatcher = new Dispatcher();

		mockNode = {
			attach: vi.fn(),
			detach: vi.fn(),
			dispatch: vi.fn()
		} as unknown as Node;

		mockAddress = new Address(['test']);
	});

	it('Set root and spawn timer', () => {
		dispatcher.setRoot(mockNode, mockAddress);

		expect(dispatcher.root).toBe(mockNode);
		expect(mockNode.attach).toHaveBeenCalledOnce();
		expect(mockNode.attach).toHaveBeenCalledWith(dispatcher, mockAddress);
	});

	it('Delete root and clear timer', () => {
		dispatcher.setRoot(mockNode, mockAddress);
		dispatcher.removeRoot();

		expect(dispatcher.root).toBe(null);
		expect(mockNode.detach).toHaveBeenCalledOnce();
	});

	it('Run timer in loop', () => {
		const spy = vi.spyOn(global, 'setTimeout');
		dispatcher.loop();
		expect(spy).toHaveBeenCalledWith(expect.any(Function), 10000);
		spy.mockRestore();
	});

	it('clearTimeout calls in removeRoot', () => {
		const clearSpy = vi.spyOn(global, 'clearTimeout');
		dispatcher.setRoot(mockNode, mockAddress);
		dispatcher.removeRoot();
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});
});