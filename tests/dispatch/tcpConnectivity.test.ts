import net from "net"
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import Dispatcher from '../../src/common/dispatcher.ts'
import Address from '../../src/common/address.ts'
import { Event } from '../../src/common/event.ts'
import { Node } from '../../src/common/node.ts'
import { TCPEndpoint } from "../../src/node/tcpEndpoint.ts"
import { TCPConnector } from "../../src/node/tcpConnector.ts"

function setupPair () {
	const server = net.createServer();
	const localDispatcher = new Dispatcher();
	const endpoint = new TCPEndpoint(server);
	const localNode = new Node();
	const localReceiver = new Node();
	localDispatcher.setRoot(localNode, new Address(["root"]));
	localNode.addChild("localReceiver", localReceiver);
	localNode.addChild("endpoint", endpoint);
	server.listen(0);

	const port = (server.address() as any).port

	// remote 
	const remoteDispatcher = new Dispatcher();
	const remoteConnector = new TCPConnector({
		interval: 500,
		threshold: 5,
		host: "127.0.0.1",
		port: port
	});
	remoteDispatcher.setRoot(remoteConnector, new Address([]));
	const remoteReceiver = new Node();
	remoteConnector.addChild("remoteReceiver", remoteReceiver);

	let recvSet: Set<string> = new Set();

	localReceiver.setListener("call", () => {
		recvSet.add("localReceiver");
	});
	remoteReceiver.setListener("call", () => {
		recvSet.add("remoteReceiver");
	});

	return {
		server,
		localDispatcher,
		remoteDispatcher,
		remoteConnector,
		localReceiver,
		remoteReceiver,
		recvSet
	}
}

describe("TCP connectivity", () => {
	it("Mock connection gets correct address", async () => {
		const connectedPair = setupPair();

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		expect(connectedPair.remoteConnector.address.data).toEqual(["root", "endpoint", "0"]);

		connectedPair.localDispatcher.removeRoot();
		connectedPair.remoteDispatcher.removeRoot();
		connectedPair.server.close();
	});

	it("TCP test, remote to local", async () => {
		const connectedPair = setupPair();

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		connectedPair.remoteReceiver.send(["root", "localReceiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		expect(connectedPair.recvSet).toEqual(new Set(["localReceiver"]));

		connectedPair.localDispatcher.removeRoot();
		connectedPair.remoteDispatcher.removeRoot();
		connectedPair.server.close();
	});

	it("TCP test, local to remote", async () => {
		const connectedPair = setupPair();

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		connectedPair.localReceiver.send(["root", "endpoint", "0", "remoteReceiver"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		expect(connectedPair.recvSet).toEqual(new Set(["remoteReceiver"]));

		connectedPair.localDispatcher.removeRoot();
		connectedPair.remoteDispatcher.removeRoot();
		connectedPair.server.close();
	});

	it("TCP test, local to local", async () => {
		const connectedPair = setupPair();

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		const spy = vi.spyOn(connectedPair.remoteDispatcher, "dispatch");

		const subNode = new Node();
		connectedPair.localReceiver.addChild("sn", subNode);
		subNode.setListener("call", () => {
			connectedPair.recvSet.add("sn")
		});

		connectedPair.localReceiver.send(["root", "localReceiver", "sn"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		expect(connectedPair.recvSet).toEqual(new Set(["sn"]));
		expect(spy).not.toHaveBeenCalled();

		connectedPair.localDispatcher.removeRoot();
		connectedPair.remoteDispatcher.removeRoot();
		connectedPair.server.close();
	});

	it("TCP test, remote to remote", async () => {
		const connectedPair = setupPair();

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		const spy = vi.spyOn(connectedPair.localDispatcher, "dispatch");

		const subNode = new Node();
		connectedPair.remoteReceiver.addChild("sn", subNode);
		subNode.setListener("call", () => {
			connectedPair.recvSet.add("sn")
		});

		connectedPair.remoteReceiver.send(["root", "endpoint", "0", "remoteReceiver", "sn"], {
			command: "call"
		});

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve();
			}, 300);
		});

		expect(connectedPair.recvSet).toEqual(new Set(["sn"]));
		expect(spy).not.toHaveBeenCalled();

		connectedPair.localDispatcher.removeRoot();
		connectedPair.remoteDispatcher.removeRoot();
		connectedPair.server.close();
	});
});