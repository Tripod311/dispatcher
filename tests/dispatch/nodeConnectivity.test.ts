import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Dispatcher from '../../src/common/dispatcher.ts';
import Address from '../../src/common/address.ts';
import { Event } from '../../src/common/event.ts';
import { Node } from '../../src/common/node.ts';

describe("Basic event dispatching", () => {
	// make node tree
	const dispatcher = new Dispatcher();
	const rootNode = new Node();
	dispatcher.setRoot(rootNode, new Address(["root"]));
	const bNode = new Node();
	rootNode.addChild("b", bNode);
	const aNode = new Node();
	bNode.addChild("a", aNode);
	const cNode = new Node();
	bNode.addChild("c", cNode);
	const dNode = new Node();
	rootNode.addChild("d", dNode);
	const eNode = new Node();
	dNode.addChild("e", eNode);
	const fNode = new Node();
	eNode.addChild("f", fNode);

	const callMap = {
		a: 0,
		b: 0,
		c: 0,
		d: 0,
		e: 0,
		f: 0
	};

	function nodeCalled (nodeName) {
		callMap[nodeName]++;
	}

	aNode.setListener("call", nodeCalled.bind({}, "a"));
	bNode.setListener("call", nodeCalled.bind({}, "b"));
	cNode.setListener("call", nodeCalled.bind({}, "c"));
	dNode.setListener("call", nodeCalled.bind({}, "d"));
	eNode.setListener("call", nodeCalled.bind({}, "e"));
	fNode.setListener("call", nodeCalled.bind({}, "f"));

	beforeEach(() => {
		for (let name in callMap) {
			callMap[name] = 0;
		}
	});

	afterAll(() => {
		dispatcher.removeRoot();
	});

	it("Passing events to every node", () => {
		rootNode.send(["root", "b"], {command: "call"});
		rootNode.send(["root", "b", "a"], {command: "call"});
		rootNode.send(["root", "b", "c"], {command: "call"});
		rootNode.send(["root", "d"], {command: "call"});
		rootNode.send(["root", "d", "e"], {command: "call"});
		rootNode.send(["root", "d", "e", "f"], {command: "call"});

		expect(callMap).toEqual({
			a: 1,
			b: 1,
			c: 1,
			d: 1,
			e: 1,
			f: 1
		});
	});

	it("Passing events to some nodes", () => {
		rootNode.send(["root", "b"], {command: "call"});
		// rootNode.send(["root", "b", "a"], {command: "call"});
		rootNode.send(["root", "b", "c"], {command: "call"});
		rootNode.send(["root", "d"], {command: "call"});
		// rootNode.send(["root", "d", "e"], {command: "call"});
		rootNode.send(["root", "d", "e", "f"], {command: "call"});

		expect(callMap).toEqual({
			a: 0,
			b: 1,
			c: 1,
			d: 1,
			e: 0,
			f: 1
		});
	});
});