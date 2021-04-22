import { Socket } from 'node:net';
import ipc from 'node-ipc';
import { getSocket, SERVICE_NAME, SocketHandlerEvent } from '../constants';

interface ITransaction {
	id: number;
	response?: string; // for server response
	payload?: string; // for client request
}

class Transaction implements ITransaction {
	id: number;
	promiseInstance: Promise<any>;
	response?: string;

	_resolve?: (v: any) => void;
	_reject?: (v: any) => void;

	constructor(id = TRANSACTION_COUNT++) {
		this.id = id;
		this.promiseInstance = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	serialize = (payload?: string): string => {
		const t: ITransaction = {
			id: this.id,
			response: this.response,
			payload
		};
		return JSON.stringify(t);
	};

	update = (transaction: ITransaction) => {
		const response = transaction.response;
		this.response = response;
	};

	handle = (payload: string) => {
		if (this._resolve) {
			this._resolve(payload);
		}
	};
}

let TRANSACTION_COUNT = 0;

export abstract class Endpoint {
	public abstract name: string;
	protected abstract _clientHandler(data: string): string | Promise<string>;
	protected abstract _serverHandler(data: string): string | Promise<string>;
	public abstract fire(...args: any): Promise<any>;
	private static transactions: Transaction[] = [];

	// public setClientSocket(socket: Socket) {
	//   this.socket = socket;
	// }

	public clientEmmit = (data: Buffer) => {
		const socket = getSocket(SERVICE_NAME);
		socket.emit(this.name, data);
	};

	public serviceEmit = (socket: Socket, data: Buffer) => {
		ipc.server.emit(socket, this.name, data);
	};

	public getClientHandler() {
		return async (event: SocketHandlerEvent) => {
			const data = Buffer.from(event.data);
			const serializedTransaction = data.toString();
			const incommingTransaction = JSON.parse(serializedTransaction) as ITransaction;
			const transactionId = incommingTransaction.id;
			const transactionInstance = this.findTransaction(transactionId);
			transactionInstance?.update(incommingTransaction);

			if (transactionInstance && transactionInstance.response) {
				const response = await this._clientHandler(transactionInstance.response);
				transactionInstance.handle(response);
			} else {
				console.error(`Invalid transaction: ${incommingTransaction}`);
			}
		};
	}

	public getServerHandler() {
		return async (event: SocketHandlerEvent, socket: Socket) => {
			console.log(`Server handler :P`);
			const data = Buffer.from(event.data);
			const serializedTransaction = data.toString();
			console.log(`Recieved transaction ${serializedTransaction}`);
			const transaction = JSON.parse(serializedTransaction) as ITransaction;
			const transactionId = transaction.id;
			if (typeof transactionId === 'number') {
				const result = await this._serverHandler(transaction.payload as string);
				delete transaction.payload;
				transaction.response = result;
				const serializedResponse = JSON.stringify(transaction);
				const response = Buffer.from(serializedResponse);
				this.serviceEmit(socket, response);
			}
		};
	}

	protected newTransaction(t: ITransaction = new Transaction()): Transaction {
		const transaction = t as Transaction;
		Endpoint.transactions.push(transaction);
		return transaction;
	}

	// protected handleTransaction(id: number, payload: Object): void {
	//   const transactionIndex = Endpoint.transactions.findIndex(
	//     (t) => t.id === id
	//   );
	//   const transaction = Endpoint.transactions.splice(transactionIndex, 1)[0];
	//   transaction.handle(payload);
	// }

	protected findTransaction(id: number): Transaction | undefined {
		const transaction = Endpoint.transactions.find((t) => t.id === id);
		return transaction;
	}
}
