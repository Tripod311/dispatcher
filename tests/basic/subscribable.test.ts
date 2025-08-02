import { describe, it, expect, beforeEach, vi } from 'vitest';
import Subscribable from '../../src/common/subscribable';
import Dispatcher from '../../src/common/dispatcher';
import Address from '../../src/common/address';
import { Event } from '../../src/common/event';

describe('Subscribable', () => {
	let node: Subscribable;
	let dispatcher: Dispatcher;
	let address: Address;

	beforeEach(() => {
		node = new Subscribable();
		dispatcher = {
			dispatch: vi.fn()
		} as unknown as Dispatcher;
		address = new Address(['sub']);
		node.attach(dispatcher, address);
	});

	it('attach adds listeners', () => {
		const event = new Event(dispatcher, new Address(['user']), address, { command: 'subscribe' });
		node['handle'](event); // вызовет this.subscribe

		expect(node['subscribers'].length).toBe(1);
		expect(node['subscribers'][0].equals(new Address(['user']))).toBe(true);
	});

	it('subscriber address is unique', () => {
		const sender = new Address(['dup']);
		const ev1 = new Event(dispatcher, sender, address, { command: 'subscribe' });
		const ev2 = new Event(dispatcher, sender, address, { command: 'subscribe' });

		node['subscribe'](ev1);
		node['subscribe'](ev2);

		expect(node['subscribers'].length).toBe(1);
	});

	it('unsubscribe deletes subscriber correctly', () => {
		const sender = new Address(['gone']);
		const evSub = new Event(dispatcher, sender, address, { command: 'subscribe' });
		const evUnsub = new Event(dispatcher, sender, address, { command: 'unsubscribe' });

		node['subscribe'](evSub);
		node['unsubscribe'](evUnsub);

		expect(node['subscribers'].length).toBe(0);
	});

	it('unsubscribe without subscription', () => {
		const evUnsub = new Event(dispatcher, new Address(['ghost']), address, { command: 'unsubscribe' });
		node['unsubscribe'](evUnsub);
		expect(node['subscribers'].length).toBe(0);
	});

	it('notify with exceptList', () => {
		const a1 = new Address(['a']);
		const a2 = new Address(['b']);
		const a3 = new Address(['c']);

		node['subscribers'] = [a1, a2, a3];
		const sendSpy = vi.spyOn(node, 'send');

		const data = { command: 'news', details: 'Hello' };
		node.notify(data, [a2]);

		expect(sendSpy).toHaveBeenCalledTimes(2);
		expect(sendSpy).toHaveBeenCalledWith(a1, data);
		expect(sendSpy).toHaveBeenCalledWith(a3, data);
		expect(sendSpy).not.toHaveBeenCalledWith(a2, data);
	});

	it('notify without exceptList', () => {
		const a1 = new Address(['a']);
		const a2 = new Address(['b']);
		node['subscribers'] = [a1, a2];
		const sendSpy = vi.spyOn(node, 'send');

		const data = { command: 'update' };
		node.notify(data, []);

		expect(sendSpy).toHaveBeenCalledTimes(2);
		expect(sendSpy).toHaveBeenCalledWith(a1, data);
		expect(sendSpy).toHaveBeenCalledWith(a2, data);
	});
});