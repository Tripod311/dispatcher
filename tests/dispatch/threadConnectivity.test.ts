import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import Dispatcher from '../../src/common/dispatcher.ts'
import Address from '../../src/common/address.ts'
import { Event } from '../../src/common/event.ts'
import { Node } from '../../src/common/node.ts'
import { ThreadNode } from "../../src/node/threadNode.ts"

function createPair () {
	const dispatcher = new Dispatcher();
	const root = new Node();
	dispatcher.setRoot(root, new Address(["root"]));
	const receiver = new Node();
	root.addChild("receiver", receiver);
	const thread = new ThreadNode("./tests/dispatch/thread.js", {
		interval: 500,
		threshold: 5
	});
	root.addChild("thread", thread);

	return {
		dispatcher,
		root,
		receiver,
		thread
	};
}

describe("Thread connectivity test", () => {
	it("Check address", async () => {
		const setup = createPair();

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		let addr: string[] | undefined = undefined;

		setup.receiver.setListener("addressResponse", (event: Event) => {
			addr = event.data.data.address as string[];
		});

		setup.receiver.send(["root", "thread", "receiver"], {
			command: "address"
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		expect(addr).toEqual(["root", "thread", "receiver"]);

		setup.dispatcher.removeRoot();
	});

	it("Passing events", async () => {
		const setup = createPair();

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		let addr: string[] | undefined = undefined;

		setup.receiver.setListener("subNodeCall", (event: Event) => {
			addr = event.sender.data;
		});

		setup.receiver.send(["root", "thread", "receiver"], {
			command: "call"
		}, true);

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		expect(addr).toEqual(["root", "thread", "receiver", "subNode"]);

		setup.dispatcher.removeRoot();
	});
});