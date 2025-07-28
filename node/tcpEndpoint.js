const Node = require("../common/node.js");
const Connection = require("./tcpConnection.js");
const Log = require("../utils/log.js");

class TCPEndpoint extends Node {
	constructor (server, pingOptions) {
		super();
		
		this.server = server;
		this.pingOptions = pingOptions || {
			threshold: 5,
			interval: 5000
		};
		this.connectionListener = this.connection.bind(this);
		this.errorListener = this.error.bind(this);
		this.counter = 0;
	}

	attach (dispatcher, address) {
		super.attach.call(this, dispatcher, address);

		this.server.on("connection", this.connectionListener);
		this.server.on("error", this.errorListener);

		this.setListener("closeConnection", this.closeConnection.bind(this));
	}

	detach () {
		this.server.off("connection", this.connectionListener);
		this.server.off("error", this.errorListener);

		super.detach.call(this);
	}

	connection (socket) {
		let id = this.counter++;
		this.addChild(id.toString(), new Connection(id, socket, this.pingOptions));
	}

	error (e) {
		Log.error("TCPEndpoint error: " + e, 1);
	}

	closeConnection (event) {
		this.delChild(event.data.id);
	}
}

module.exports = TCPEndpoint;