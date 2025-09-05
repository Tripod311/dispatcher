import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { WebSocketServer, WebSocket } from "ws"
import Dispatcher from '../../src/common/dispatcher.ts'
import Address from '../../src/common/address.ts'
import { Event } from '../../src/common/event.ts'
import { Node } from '../../src/common/node.ts'
import WSEndpoint from "../../src/node/wsEndpoint.ts"
import WSConnector from "../../src/browser/wsConnector.ts"

async function setupPair () {
	const localDispatcher = new Dispatcher();
	const root = new Node();
	const localReceiver = new Node();
	const server = new WebSocketServer({port: 0});
	const endpoint = new WSEndpoint(server, {interval: 500, threshold: 5});
	localDispatcher.setRoot(root, new Address(["root"]));
	root.addChild("receiver", localReceiver);
	root.addChild("endpoint", endpoint);

	endpoint.restrictions.add(new Address(["root", "receiver"]));

	await new Promise(resolve => server.once('listening', resolve));

	// remote

	const port = server.address().port;
	const remoteDispatcher = new Dispatcher();
	const remoteConnector = new WSConnector("ws://127.0.0.1:" + port, { interval: 500, threshold: 5 });
	remoteDispatcher.setRoot(remoteConnector, new Address([]));

	return {
		localDispatcher,
		remoteDispatcher,
		localReceiver,
		remoteConnector
	}
}

vi.stubGlobal("WebSocket", WebSocket);

describe("WebSocket connectivity test", () => {
	it("Address check", async () => {
		const setup = await setupPair();

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		expect(setup.remoteConnector.address.data).toEqual(["root", "endpoint", "0"]);

		setup.remoteDispatcher.removeRoot();
		setup.localDispatcher.removeRoot();
	});

	it("Passing events", async () => {
		const setup = await setupPair();

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		const calls: Set<string> = new Set();

		const remoteReceiver = new Node();
		setup.remoteConnector.addChild("receiver", remoteReceiver);
		const remoteSubNode = new Node();
		remoteReceiver.addChild("subNode", remoteSubNode);
		setup.localReceiver.setListener("call", () => {
			calls.add("local");
		});
		remoteReceiver.setListener("call", () => {
			calls.add("remote");
		});
		remoteSubNode.setListener("call", () => {
			calls.add("subnode");
		});

		setup.localReceiver.send(["root", "endpoint", "0", "receiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});

		expect(calls).toEqual(new Set(["remote"]));

		remoteReceiver.send(["root", "receiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 100);
		});

		expect(calls).toEqual(new Set(["remote", "local"]));

		remoteReceiver.send(["root", "endpoint", "0", "receiver", "subNode"], {
			command: "call"
		});

		expect(calls).toEqual(new Set(["remote", "local", "subnode"]));

		setup.remoteDispatcher.removeRoot();
		setup.localDispatcher.removeRoot();
	});
});