import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import HTTP from "http"
import Dispatcher from '../../src/common/dispatcher.ts'
import Address from '../../src/common/address.ts'
import { Event } from '../../src/common/event.ts'
import { Node } from '../../src/common/node.ts'
import HTTPEndpoint from '../../src/node/httpEndpoint.ts'
import HTTPConnector from "../../src/browser/httpConnector.ts"

async function setup () {
	const dispatcher = new Dispatcher();
	const root = new Node();
	const receiver = new Node();
	const server = HTTP.createServer();
	const endpoint = new HTTPEndpoint(server, 10000);
	dispatcher.setRoot(root, new Address(["root"]));
	root.addChild("receiver", receiver);
	root.addChild("endpoint", endpoint);

	endpoint.restrictions.add(new Address(["root", "receiver"]));

	await new Promise(resolve => { server.listen(0, resolve) });

	return {
		dispatcher,
		root,
		receiver,
		endpoint,
		server
	}
}

describe("HTTPEndpoint test", () => {
	it("Connection test", async () => {
		const set = await setup();

		const port = set.server.address().port;

		const localDispatcher = new Dispatcher();
		const localConnector = new HTTPConnector("http://localhost:" + port, 500);
		localDispatcher.setRoot(localConnector, new Address([]));

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		expect(localConnector.isRegistered).toBeTruthy();
		expect(localConnector.address.data).toEqual(["root", "endpoint", "0"]);

		set.server.close();
		set.dispatcher.removeRoot();
	});

	it("Dispatch through connector", async () => {
		const set = await setup();

		const port = set.server.address().port;

		const localDispatcher = new Dispatcher();
		const localConnector = new HTTPConnector("http://localhost:" + port, 500);
		localDispatcher.setRoot(localConnector, new Address([]));

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		const recvSet: Set<string> = new Set();
		const localReceiver = new Node();
		localReceiver.setListener("call", () => {
			recvSet.add("local");
		});
		set.receiver.setListener("call", () => {
			recvSet.add("remote");
		});
		localConnector.addChild("receiver", localReceiver);

		localConnector.send(["root", "receiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 300);
		});

		expect(recvSet).toEqual(new Set(["remote"]));

		set.receiver.send(["root", "endpoint", "0", "receiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});

		expect(recvSet).toEqual(new Set(["remote", "local"]));

		set.server.close();
		set.dispatcher.removeRoot();
	});
});