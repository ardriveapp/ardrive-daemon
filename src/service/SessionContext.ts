import { Socket } from 'net';
import ipc from 'node-ipc';

const instances: SessionContext[] = [];

export class SessionContext {
	private dict: { [key: string]: any } = {};

	constructor(private socket: Socket) {
		const existingContext = SessionContext.getContextFromSocket(socket);
		if (existingContext) {
			return existingContext;
		}
		instances.push(this);
		return this;
	}

	public _drop(): void {
		const myIndex = instances.indexOf(this);
		instances.splice(myIndex, 1);
	}

	public set(key: string, value: any): void {
		this.dict[key] = value;
	}

	public get(key: string): any {
		return this.dict[key];
	}

	public remove(key: string): void {
		delete this.dict[key];
	}

	static refreshInstances(): void {
		const sockets = ((ipc.server as unknown) as { sockets: Socket[] }).sockets || [];
		const removedInstances = Array.from(instances);
		for (const socket of sockets) {
			const stillExistingContext = new SessionContext(socket);
			const stillExistingContextIndex = removedInstances.indexOf(stillExistingContext);
			removedInstances.splice(stillExistingContextIndex, 1);
		}
		removedInstances.forEach((i) => i._drop());
	}

	static getContextFromSocket(socket: Socket): SessionContext | null {
		const context = instances.find((i: SessionContext) => i.socket === socket);
		return context || null;
	}
}
