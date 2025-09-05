Dispatch is a lightweight framework for building event-driven applications by splitting logic into independent units and connecting them through a unified communication layer.

## Core Concepts

Application logic can be divided into multiple nodes — independent logic units. Dispatch provides simple interfaces to define these nodes and connect them in a flexible way. A node can run locally, in a worker, on a remote host, or even inside a browser.

Nodes interact through a built-in transport layer, which makes communication seamless: to send a message, a node only needs to know the recipient’s address and call Node.send(). The framework takes care of delivering the event, regardless of where the recipient is running.

This architecture allows you to start developing without worrying about performance bottlenecks. When bottlenecks appear, you can easily move nodes to another process, machine, or environment — without rewriting their logic.

In Dispatch:

- Nodes encapsulate logic.
- Addresses identify nodes in the system.
- Events are the universal way nodes communicate.

## Core Concepts

Dispatch applications are built around four core components:

- Dispatcher — the glue that connects all nodes. It manages the application lifecycle, always holds a root node, and is mostly used to start or stop the application.
- Node — a unit of logic in the system. Nodes receive and process events.
- Address — a unique sequence of strings that identifies a node’s position in the system. Every node must have an address.
- Event — a message sent from one node to another. An event carries:
  - system meta information,
  - a command (used by the recipient node to decide what action to take),
  - a payload (custom data for the command).

Nodes send events by calling Node.send(address, event). The dispatcher ensures the event reaches the correct recipient, regardless of where it runs (local, worker, remote host, or browser).


## Short Example


```ts
import { Dispatcher, Node, Address, Event } from "@tripod311/dispatch";

class MyRoot extends Node {
  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    // Listen for "call" events
    this.setListener("call", this.callHandler.bind(this));
  }

  callHandler(event: Event) {
    console.log("Hello");

    event.response({
      command: "call",
    });
  }
}

class MyChildNode extends Node {
  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    this.setListener("call", this.callHandler.bind(this));
  }

  callHandler(event: Event) {
    console.log("World");
  }
}

const dispatcher = new Dispatcher();
const root = new MyRoot();
const childNode = new MyChildNode();

dispatcher.setRoot(root, new Address(["root"]));
// childNode will have address ["root", "child"]
root.addChild("child", childNode);

// Child sends event to root
childNode.send(["root"], {
  command: "call",
});
```

Output:

Hello
World


## Why Dispatch?


Dispatch is not designed to be the fastest service-to-service communication layer — if raw speed is your priority, you might prefer tools like gRPC or other optimized solutions.

Instead, Dispatch focuses on simplicity and structure. It allows you to design applications that:

Run seamlessly across multiple hosts (local, remote, browser, worker threads).

Treat clients and services as equal parts of the same event-driven system.

Use the same transport interface everywhere — no matter where the code is running.

With Dispatch, you don’t have to worry about whether a node is local, remote, or in another process. You just call:

```ts
node.send(address, event);
node.chain(address, event, callback);
```

…and the framework handles all routing, serialization, and delivery for you.

This unified approach makes it easy to split application logic into independent units, move them between environments, and still have them work together as a single, coherent system.

## API

### Dispatcher

The Dispatcher is the entry point of every Dispatch application (or sub-application).
It is responsible for initializing and shutting down the application.

In most cases, starting a root application looks like this:

```ts
import { Dispatcher, Address } from "dispatch";

const dispatcher = new Dispatcher();
const root = new MyRoot();

// Graceful shutdown
process.on("SIGINT", () => {
  dispatcher.removeRoot();
});

process.on("SIGTERM", () => {
  dispatcher.removeRoot();
});

// Set root node
dispatcher.setRoot(root, new Address(["root"]));
```


Key points:
- Dispatcher manages the application lifecycle.
- `setRoot`() registers the root node at a given Address.
- `removeRoot`() gracefully shuts down the root node (e.g., on termination signals).

### Address

The Address class represents a unique position of a node in the system.
Internally, it’s just a sequence of strings.

Usage
```ts
const addr1 = new Address(["root", "child"]);
const addr2 = new Address(addr1);

console.log(addr1.equals(addr2)); // true
console.log(addr1.toString());    // [root, child]
console.log(addr1.parent);        // [root]
console.log(addr1.length);        // 2
```

#### Methods

`constructor(data: string[] | Address)`
Creates an address from an array of strings or clones an existing Address.

`equals(addr: Address): boolean`
Checks if two addresses are identical.

`clone(): Address`
Returns a copy of the address.

`isParentOf(addr: Address): boolean`
Returns true if this address is a prefix (parent) of another.

`toString(): string`
Converts address to string format: [part1, part2, ...].

`get data(): string[] / set data(data: string[])`
Gets or sets the underlying string sequence.

`get parent(): Address`
Returns the parent address (one level up).

`get length(): number`
Returns the number of segments in the address.

### Event

An Event is the fundamental data unit that nodes exchange.
It contains system metadata (sender, destination, etc.) and an EventData payload.

In most cases you won't be creating event manually and will be using Node.send, Node.chain and event.response methods.
In most cases, you’ll only need to work with the command and data fields inside the event.

Example

```ts
// Create and send event
childNode.send(["root"], {
  command: "sayHello",
  data: { name: "Alice" }
});

// Handle event in root node
this.setListener("sayHello", (event: Event) => {
  console.log("Hello,", event.data?.name);
  event.response({
    command: "sayHello",
    data: { status: "ok" }
  });
});
```

Output:

Hello, Alice

#### EventData interface

```ts
interface EventData {
  command: string;     // Command name (required)
  error?: boolean;     // Marks the event as error
  details?: string;    // Error details or extra info
  data?: any;          // Custom payload
}
```

#### Methods

`constructor(dispatcher, sender, destination, data, isResponse = false, trace = false)`
Creates a new event. `sender` and `destination` are Address instances. `data` must contain a command.

`dispatch(hop = 0): void`
Sends the event via the dispatcher.

`response(obj: EventData): void`
Sends a response back to the original sender.
Automatically reuses the request ID if present.

`captureTransfers(): any[]`
Extracts all ArrayBuffer objects from the event data (useful for binary transfers).

System Fields:
- `sender: Address` — who sent the event.
- `destination: Address` — where the event should go.
- `data: EventData` — payload.
- `isResponse: boolean` — marks event as a response.
- `trace: boolean` — debug/trace flag.
- `reqId?: number` — request ID for correlating requests and responses. You shouldn't modify this field, it's used only in chain requests.

### Node

A Node is a logic unit of the application.
When attached to a dispatcher, it gets a unique Address and can send or receive Events.

Essentials:

`setListener(command, fn)` — register an event handler.

`send(destination, data, trace = false)` — send an event to another node.

`chain(destination, data, callback, trace = false)` — send an event and wait for a response (request/response pattern).

`addChild(id, node)` — attach a child node under a sub-address.

`delChild(id)` - delete/detach a child node

#### Example

```ts
class MyNode extends Node {
  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    this.setListener("ping", (event) => {
      console.log("Got ping from", event.sender.toString());
      event.response({ command: "pong" });
    });
  }
}

const dispatcher = new Dispatcher();
const root = new MyNode();

dispatcher.setRoot(root, new Address(["root"]));

// Root node receives "ping"
root.send(["root"], { command: "ping" });
```

Output:

Got ping from [root]

In most cases, the typical approach for developers is to subclass Node,
add custom methods, register listeners and add child nodes inside the attach() method.
This turns the subclass into a fully functional logical unit of the application.

```ts
class MyService extends Node {
  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    this.setListener("process", this.processHandler.bind(this));
  }

  processHandler(event: Event) {
    console.log("Processing:", event.data);
    event.response({ command: "process", data: "done" });
  }
}
```
### Subscribable

The Subscribable class is a special type of Node with built-in subscription management.
Other nodes can subscribe/unsubscribe to it and receive notifications when events are published.

#### Usage
```ts
import { Subscribable } from "@tripod311/dispatch"

class MyChannel extends Subscribable {
  subscribe(event: Event) {
    // Always call super.subscribe first
    super.subscribe(event);

    // Optionally send initial state or welcome data
    event.response({
      command: "init",
      data: { status: "subscribed" },
    });
  }
}

const channel = new MyChannel();
root.addChild("channel", channel);

// Somewhere else in the system
someNode.send(["root", "channel"], { command: "subscribe" });

//notify all subscribed nodes
channel.notify({
  command: "somethingHappened",
  data: { ... }
})
```

#### Methods

`subscribe(event: Event)`
Registers a subscriber (based on sender address).
Can be overridden — just make sure to call super.subscribe(event) first.

`unsubscribe(event: Event)`
Removes a subscriber.

`notify(data: EventData, except: Address[])`
Sends data to all subscribers except those listed in except.

## Moving Nodes to Separate Threads


If you need to handle heavy tasks without blocking the main thread, you can move logic into a worker thread.
Dispatch provides ThreadNode and ThreadConnector classes for this purpose.

### Example

#### myNode.ts

```ts
import { Node, ThreadNode, Dispatcher, Address, Event } from "@tripod311/dispatch";
import WorkerScript from "./workerScript.js";

export default class MyNode extends Node {
  private worker!: ThreadNode;

  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    this.worker = new ThreadNode(WorkerScript, {
      // These options prevent a buggy worker from endlessly eating CPU.
      // interval = ping interval (ms)
      // threshold = number of failed pings before termination
      // To disable, set interval=0
      interval: 1000,
      threshold: 5,
    });

    this.addChild("worker", this.worker);

    this.chain(this.address!.data.concat(["worker", "receiver"]), {
      command: "performHighloadTask",
      data: {
        // some data for task
      },
    }, (response: Event) => {
      // handle worker response
    });
  }
}
```

#### workerScript.ts

```ts
import { ThreadConnector, Event } from "@tripod311/dispatch";

const connector = new ThreadConnector();
connector.readyPromise.then(() => {
  connector.setListener("performHighloadTask", (event: Event) => {
    // heavy logic here
    event.response({
      command: "performHighloadTaskResponse",
      data: {
        // some result
      },
    });
  });
}, () => {
  // something went wrong during worker startup
});
```

## Moving Nodes to a Separate Host

Sometimes, parts of an application need to run on a separate host.
Dispatch supports this out of the box with TCPEndpoint (server side) and TCPConnector (client side).

### Example

#### myNode.ts (main host)

```ts
import net from "net";
import { Node, TCPEndpoint, Dispatcher, Address, Event } from "@tripod311/dispatch";

export default class MyNode extends Node {
  private endpoint!: TCPEndpoint;

  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    const server = net.createServer();
    this.endpoint = new TCPEndpoint(server, {
      // works the same as ThreadNode ping options
      interval: 500,
      threshold: 5,
    });
    server.listen(0);

    this.addChild("endpoint", this.endpoint);

    this.setListener("subServiceData", this.subServiceDataHandle.bind(this));
  }

  subServiceDataHandle(event: Event) {
    // process data from remote host
  }
}
```


#### remoteHostNode.ts (remote host)

```ts
import net from "net";
import { TCPConnector, Dispatcher, Address, Event } from "@tripod311/dispatch";

const dispatcher = new Dispatcher();
const connector = new TCPConnector({
  interval: 500,
  threshold: 5,
  host: "127.0.0.1",
  port: port, // replace with actual port
});

dispatcher.setRoot(connector, new Address([]));

connector.readyPromise.then(() => {
  connector.send(connector.address.parent, {
    command: "subServiceData",
    data: {
      // event payload
    },
  });
}, (err: any) => {
  // connection error
  dispatcher.removeRoot();
});
```

### Notes on Design

- TCPEndpoint does not create or start a server by itself. You must provide an existing net.Server instance to the constructor and call server.listen() manually. Likewise, you need to close the server manually when it’s no longer needed — simply detaching the node is not enough.
- TCPConnector, on the other hand, manages its own socket. It creates the connection when attached and closes it automatically when detached.
- TCPEndpoint restriction mechanism
  - By default, a TCPEndpoint node only allows events to flow to addresses that are its children.
  - To relax this restriction, you can pass a third constructor argument: allowedAddresses. This must be either a Set of Addresses or an array of Address instances.
  - Or you may do endpoint.restrictions.add(address) to whitelist address on a created endpoint.
  - This mechanism acts as a safety layer, preventing unwanted event forwarding outside the intended scope.
- Dispatch applications are structured hierarchically: nodes form a tree. When a TCPConnector attaches to the dispatcher, it creates a connection and waits for a special "register" event, which assigns its real address in the system. Its initial address does not matter — it will be overwritten.
- Because of the hierarchy, the TCPConnector should be the root node in the sub-service. All other nodes must be attached only after it receives its address.
- If you need a non-hierarchical design, you can implement your own connection node (covered later).

## Connecting a Browser

For web applications you have several options:
- API. Just take express or fastify or any tool that you like and convert api calls into chained events.
- WebSockets — Use WSEndpoint (server) with WSConnector (browser).
- Long Polling — Use HTTPEndpoint (server) with HTTPConnector (browser).

Both WebSocket and HTTP connectors follow the same design as TCPEndpoint–TCPConnector.

### WebSocket Example

#### myNode.ts (main host)

```ts
import { WebSocketServer } from "ws";
import { Node, WSEndpoint, Dispatcher, Address, Event } from "@tripod311/dispatch";

export default class MyNode extends Node {
  private endpoint!: WSEndpoint;

  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    const server = new WebSocketServer({ port: 0 });
    this.endpoint = new WSEndpoint(server, {
      interval: 500,
      threshold: 5,
    });

    this.addChild("endpoint", this.endpoint);

    this.setListener("wsClientData", this.wsDataHandle.bind(this));
  }

  wsDataHandle(event: Event) {
    // process data from socket
  }
}
```

#### websocketConnector.ts (browser)

```ts
const dispatcher = new Dispatcher();
const connector = new WSConnector("ws://127.0.0.1:8080", {
  interval: 500,
  threshold: 5,
});
dispatcher.setRoot(connector, new Address([]));

connector.readyPromise.then(() => {
  connector.send(connector.address.parent, {
    command: "wsClientData",
    data: {
      // event payload
    },
  });
}, (err: any) => {
  // connection error
  dispatcher.removeRoot();
});
```


### Notes:

- WSEndpoint is designed to work with the ws library (the de facto WebSocket standard for Node.js).
- It uses the same restriction mechanism as TCPEndpoint:
  - Pass allowed addresses as the third constructor argument (Set<Address> or Address[]),
  - Or use endpoint.restrictions.add(address).

### HTTP Long Polling Example

#### myNode.ts (main host)

```ts
import http from "http";
import { Node, HTTPEndpoint, Dispatcher, Address, Event } from "@tripod311/dispatch";

export default class MyNode extends Node {
  private endpoint!: HTTPEndpoint;

  attach(dispatcher: Dispatcher, address: Address) {
    super.attach(dispatcher, address);

    const server = http.createServer();
    this.endpoint = new HTTPEndpoint(server, 60000, 30000); // sessionExpire, pollTime
    server.listen(8080);

    this.addChild("endpoint", this.endpoint);

    this.setListener("httpClientData", this.httpDataHandle.bind(this));
  }

  httpDataHandle(event: Event) {
    // process data from socket
  }
}
```

#### httpConnector.ts (browser)

```ts
const dispatcher = new Dispatcher();
const connector = new HTTPConnector("http://127.0.0.1:8080", 1000); // pollInterval
dispatcher.setRoot(connector, new Address([]));

connector.readyPromise.then(() => {
  connector.send(connector.address.parent, {
    command: "httpClientData",
    data: {
      // event payload
    },
  });
}, (err: any) => {
  // connection error
  dispatcher.removeRoot();
});
```

### Differences Between WebSocket and HTTP Connectors

HTTPEndpoint constructor accepts:
- server — HTTP/HTTPS server (you must call listen() and close() manually).
- sessionExpireTime — how long a session can live without communication (ms).
- sessionPollTime — how long the server holds a poll request if no events are available (ms).
- addresses — allowed addresses (Array or Set of Address instances).

HTTPConnector constructor accepts:
- host — endpoint URL.
- pollInterval — delay (ms) between the end of one poll and the next request.

## Event Serialization & Custom Connectors

Dispatch provides tools for building your own connectors and transport mechanisms.
Events can be serialized into binary form, transmitted through any channel, and deserialized back into valid Event objects.

### Binary Data in Events

Events support binary payloads.
You can pass Uint8Array inside event data, which makes it possible to transfer files — for example, via HTTPConnector (it uses multipart under the hood).

### EndpointNode & ConnectionNode

EndpointNode is similar to a regular Node, but:
- it implements the restriction mechanism (only allows events for whitelisted addresses),
- it expects all its children (added via addChild) to be instances of ConnectionNode.

To see how this works in practice, check out the implementations of TCPEndpoint, TCPConnection, and TCPConnector.

### Serialization Helpers

Dispatch provides a set of utility functions for converting events to and from binary:

`SerializeEvent(event: Event): Uint8Array`
Serializes an event into a binary buffer.

`DeserializeEvent(dispatcher: Dispatcher, data: Uint8Array): Event`
Restores a single event from binary.

`DeserializeSequence(dispatcher: Dispatcher, data: Uint8Array): Event[]`
Works like DeserializeEvent, but can process a buffer containing multiple events.

### Example:

```ts
import { Dispatcher, Event, Address, SerializeEvent, DeserializeEvent } from "@tripod311/dispatch";

const dispatcher = new Dispatcher();

const ev = new Event(dispatcher, new Address(["sender"]), new Address(["destination"]), {
  command: "someEvent",
  data: {},
});

// Serialize and restore
const serialized = SerializeEvent(ev);
const restored = DeserializeEvent(dispatcher, serialized);
```

### StreamProcessor

The StreamProcessor class can receive data from a TCP socket (or any stream) and emit Event objects.

```ts
import { Dispatcher, Event, StreamProcessor } from "@tripod311/dispatch";

const dispatcher = new Dispatcher();

/* obtain socket somehow */

const processor = new StreamProcessor(dispatcher, socket);

processor.on("message", (event: Event) => {
  // process event, or forward into system
  event.dispatch();
});

// Cleanup
processor.destructor();
```

### Custom Connectors

To implement your own connector:
- Choose your transport (e.g. custom TCP, WebRTC, in-memory).
- Use SerializeEvent and DeserializeEvent (or DeserializeSequence) to convert events to/from binary form.
- Implement a ConnectionNode subclass that receives raw data, deserializes it into events, and dispatches them.
- Optionally use StreamProcessor to simplify handling of TCP-like streams.

This gives you complete flexibility to design connectors for any communication channel while keeping Dispatch’s event-driven model intact.