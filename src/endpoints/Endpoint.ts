import { Socket } from 'node:net';
import ipc from 'node-ipc';
import { getSocket, SERVICE_NAME, SocketHandlerEvent } from '../constants';
import { Middleware } from './middleware/Middleware';
import { SessionContext } from '../service/SessionContext';
import { ArDriveDaemonError, instantiateError } from '../errors';
import { AuthenticationMiddleware } from './middleware/AuthenticationMiddleware';

interface ITransaction {
	id: number;
	response?: string; // for server response
	payload?: string; // for client request
	// for error handling
	error?: boolean;
	message?: string;
	type?: string;
}

type DATA = any; // eslint-disable-line

export class Transaction implements ITransaction {
	id: number;
	promiseInstance: Promise<DATA>;
	response?: string;
	payload?: string;
	error = false;
	message?: string;
	type?: string;

	_resolve?: (v: DATA) => void;
	_reject?: (v: DATA) => void;

	constructor(id = TRANSACTION_COUNT++) {
		this.id = id;
		this.promiseInstance = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	public serialize = (payload?: DATA): string => {
		const t: ITransaction = {
			id: this.id,
			response: this.response,
			payload,
			error: this.error,
			message: this.message,
			type: this.type
		};
		return JSON.stringify(t);
	};

	public update = (transaction: ITransaction): void => {
		const response = transaction.response;
		this.response = response;
		if (transaction.error) {
			this.error = true;
			this.message = transaction.message;
			this.type = transaction.type;
		}
	};

	public handle = (payload: DATA): void => {
		if (this._resolve) {
			this._resolve(payload);
		}
	};

	public getError = (): ArDriveDaemonError | null => {
		if (this.error && this.type) {
			return instantiateError(this.type);
		}
		return null;
	};
}

export class ErrorTransaction extends Transaction {
	error = true;
	message: string;
	type: string;

	constructor(id: number, err: ArDriveDaemonError) {
		super(id);
		this.message = err.message;
		this.type = err.name;
	}
}

let TRANSACTION_COUNT = 0;

export abstract class Endpoint {
	public abstract name: string;
	protected abstract _clientHandler(data: DATA): DATA | Promise<DATA>;
	protected abstract _serverHandler(data: DATA, context: SessionContext): DATA | Promise<DATA>;
	public abstract fire(...args: DATA): Promise<DATA>;
	protected middlewares: Middleware[] = [];
	private static transactions: Transaction[] = [];

	public requiresAuthentication = () => {
		const required = this.middlewares.find((m) => m instanceof AuthenticationMiddleware);
		return !!required;
	};

	public clientSendData(data: DATA): Transaction {
		const transactionInstance = this.newTransaction();
		const transactionData = transactionInstance.serialize(data);
		this.clientEmmit(Buffer.from(transactionData));
		return transactionInstance;
	}

	public clientEmmit = (data?: Buffer): void => {
		const socket = getSocket(SERVICE_NAME);
		socket.emit(this.name, data);
	};

	public serviceEmit = (socket: Socket, data: Buffer): void => {
		ipc.server.emit(socket, this.name, data);
	};

	public getClientHandler() {
		return async (event: SocketHandlerEvent): Promise<void> => {
			const data = Buffer.from(event.data);
			const serializedTransaction = data.toString();
			const incommingTransaction = JSON.parse(serializedTransaction) as ITransaction;
			const transactionId = incommingTransaction.id;
			const transactionInstance = this.findTransaction(transactionId);
			transactionInstance?.update(incommingTransaction);

			if (transactionInstance) {
				const error = transactionInstance.getError();
				if (error) {
					throw error;
				} else if (transactionInstance.response !== undefined) {
					const response = await this._clientHandler(transactionInstance.response).catch(
						transactionInstance.handle
					);
					transactionInstance.handle(response);
				} else {
					transactionInstance?.handle(new Error('Invalid transaction response'));
				}
			}
		};
	}

	public getServerHandler() {
		return async (event: SocketHandlerEvent, socket: Socket): Promise<void> => {
			const data = Buffer.from(event.data);
			const serializedTransaction = data.toString();
			// console.log(`Recieved transaction ${serializedTransaction}`);
			const transaction = JSON.parse(serializedTransaction) as ITransaction;
			const transactionId = Number(transaction.id);
			if (Number.isNaN(transactionId)) {
				const handledTransaction = await Middleware.concatenateHandlers(this.middlewares, this)(
					this.newTransaction(transaction, true),
					socket,
					async (transaction: Transaction): Promise<Transaction> => {
						const result = await this._serverHandler(transaction.payload, new SessionContext(socket));
						const responseTransaction: Transaction = new Transaction(transaction.id);
						responseTransaction.response = result;
						return responseTransaction;
					}
				).catch((err: ArDriveDaemonError) => {
					return new ErrorTransaction(transactionId, err);
				});
				const serializedResponse = JSON.stringify(handledTransaction);
				const response = Buffer.from(serializedResponse);
				this.serviceEmit(socket, response);
			}
		};
	}

	protected newTransaction(t: ITransaction = new Transaction(), noCache = false): Transaction {
		const transaction = t as Transaction;
		if (!noCache) {
			Endpoint.transactions.push(transaction);
		}
		return transaction;
	}

	protected findTransaction(id: number): Transaction | undefined {
		const transaction = Endpoint.transactions.find((t) => t.id === id);
		return transaction;
	}
}
