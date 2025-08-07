import type { IncomingMessage } from "http"
import type { SerializedEvent, EventData } from "../common/event.js"

const HEADERS_END = Buffer.from("\r\n\r\n", "utf8");
const RN_OFFSET = 2;

interface Part {
	key?: string;
	value?: any;
	offset: number;
	filePart?: boolean;
}

export interface Binary {
	name: string;
	mimeType: string;
	content: ArrayBuffer;
}

export class MultipartParser {
	public static parse (req: IncomingMessage): Promise<SerializedEvent> {
		return new Promise((resolve, reject) => {
			let ct = req.headers["content-type"]!.split(';');

			let boundary: string | null = null;

			for (let i=0; i<ct.length; i++) {
				let str = ct[i].trim();
				if (str.match(/^boundary\=.*$/)) {
					boundary = str.slice(str.indexOf('=')+1);
					break;
				}
			}

			if (boundary === null) {
				reject("Invalid headers, boundary not found");
				return;
			}

			let chunks: Buffer[] = [];

			req.on("data", (chunk) => {
				chunks.push(chunk);
			});

			req.on("end", () => {
				let body = Buffer.concat(chunks);
				let buffers: Binary[] = [];
				let parts: Part[] = [];
				let offset = 0;
				let part = MultipartParser.nextPart(body, Buffer.from(boundary), offset, buffers);

				while (part !== null) {
					offset = part.offset;

					if (!part.filePart) {
						parts.push(part);
					}

					if (offset === -1) {
						break;
					} else {
						part = MultipartParser.nextPart(body, Buffer.from(boundary), offset, buffers);
					}
				}

				return MultipartParser.assemble(parts, buffers);
			});
		});
	}

	private static nextPart (body: Buffer, boundary: Buffer, offset: number, buffers: Binary[]): Part | null {
		const index = body.indexOf(boundary, offset);

		if (index === -1) return null;

		// find next boundary or read till end
		let currentPart: Buffer | undefined = undefined;
		const nextIndex = body.indexOf(boundary, index + boundary.length);

		if (nextIndex === -1) {
			// last part
			currentPart = body.subarray(offset + boundary.length + RN_OFFSET);
		} else {
			// there are more parts
			currentPart = body.subarray(offset + boundary.length + RN_OFFSET, nextIndex);
		}

		// process current part
		const headersEnd = currentPart.indexOf(HEADERS_END);
		const headers = currentPart.subarray(0, headersEnd).toString("utf8").split("\r\n");

		// read part name/filename
		let isFile: boolean = false;
		let mimeType: string = "application/octet-stream";
		let name: string = "";

		for (let i=0; i<headers.length; i++) {
			const header = headers[i];
			if (header.startsWith("Content-Disposition")) {
				const arr = header.split("; ").slice(1);
				for (let j=0; j<arr.length; j++) {
					const pair = arr[j].split("=");
					switch (pair[0]) {
						case "name":
							name = pair[1];
							break;
						case "filename":
							isFile = true;
							name = pair[1];
							break;
					}
				}
			} else if (header.startsWith("Content-Type")) {
				mimeType = header.split(": ")[1];
			}
		}

		// if somehow there's no name provided, treat part as broken
		if (!name) return null;

		let result: Part = {
			offset: nextIndex
		};

		if (isFile) {
			result.filePart = true;
			const content = currentPart.subarray(headersEnd + HEADERS_END.length, currentPart.length - RN_OFFSET);
			buffers.push({
				name: MultipartParser.deQuote(name),
				mimeType: MultipartParser.deQuote (mimeType),
				content: content.buffer.slice() as ArrayBuffer
			});
		} else {
			result.key = MultipartParser.deQuote(name);
			result.value = currentPart.subarray(headersEnd + HEADERS_END.length, currentPart.length - RN_OFFSET).toString("utf8");
		}

		return result;
	}

	private static deQuote (str: string): string {
		if (str[0] === '"' && str[str.length-1] === '"') {
			return str.slice(1, str.length-1);
		} else {
			return str;
		}
	}

	private static assemble (parts: Part[], buffers: Binary[]): SerializedEvent {
		const result: Record<string, any> = {
			sender: [],
			destination: [],
			data: {},
			isResponse: false,
			trace: false
		};

		for (let i=0; i<parts.length; i++) {
			const key = parts[i].key as string;
			const value = parts[i].value as string;

			if (value.startsWith("##META")) {
				const eventMeta = JSON.parse(value.slice(6)) as SerializedEvent;
				result.sender = eventMeta.sender;
				result.destination = eventMeta.destination;
				result.isResponse = eventMeta.isResponse;
				result.trace = eventMeta.trace;
			} else if (value.startsWith("##DATA")) {
				result.data = JSON.parse(value.slice(6)) as EventData;			
			}
		}

		// replace binary
		result.data = MultipartParser.replaceBinary(buffers, result.data) as any;

		return result as SerializedEvent;
	}

	private static replaceBinary(buffers: Binary[], data: any): any {
		if (typeof data === "string") {
			if (data.startsWith("##BINARY")) {
				const index = parseInt(data.slice(8), 10);
				return buffers[index];
			} else {
				return data;
			}
		} else if (Array.isArray(data)) {
			return data.map(item => MultipartParser.replaceBinary(buffers, item));
		} else if (typeof data === "object" && data !== null) {
			const result: Record<string, any> = {};

			for (const key in data) {
				if (Object.prototype.hasOwnProperty.call(data, key)) {
					result[key] = MultipartParser.replaceBinary(buffers, data[key]);
				}
			}

			return result;
		} else {
			return data;
		}
	}
}