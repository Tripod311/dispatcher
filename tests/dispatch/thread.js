import { Node } from "../../dist/common/node.js"
import ThreadConnector from "../../dist/node/threadConnector.js"

const connector = new ThreadConnector();

connector.readyPromise.then(() => {
	const node = new Node();
	connector.addChild("receiver", node);
	const subNode = new Node();
	node.addChild("subNode", subNode);

	node.setListener("call", (event) => {
		node.send(["root", "thread", "receiver", "subNode"], {
			command: "call"
		})
	});
	node.setListener("address", (event) => {
		event.response({
			command: "addressResponse",
			data: {
				address: node.address.data
			}
		})
	});
	subNode.setListener("call", (event) => {
		subNode.send(["root", "receiver"], {
			command: "subNodeCall"
		})
	});
});

// function waitForRegistration () {
// 	if (connector.isRegistered) {
// 		const node = new Node();
// 		connector.addChild("receiver", node);
// 		const subNode = new Node();
// 		node.addChild("subNode", subNode);

// 		node.setListener("call", (event) => {
// 			node.send(["root", "thread", "receiver", "subNode"], {
// 				command: "call"
// 			})
// 		});
// 		node.setListener("address", (event) => {
// 			event.response({
// 				command: "addressResponse",
// 				data: {
// 					address: node.address.data
// 				}
// 			})
// 		});
// 		subNode.setListener("call", (event) => {
// 			subNode.send(["root", "receiver"], {
// 				command: "subNodeCall"
// 			})
// 		});
// 	} else {
// 		setTimeout(waitForRegistration, 100);
// 	}
// }

// waitForRegistration();