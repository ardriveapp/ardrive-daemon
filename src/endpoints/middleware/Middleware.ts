import { Socket } from 'net';
import { Endpoint, Transaction } from '../Endpoint';

function concatenate(
	chain: Promise<Transaction>,
	handler: (t: Transaction, s: Socket, e: Endpoint) => Promise<Transaction>,
	socket: Socket,
	endpoint: Endpoint
): Promise<Transaction> {
	return chain.then(async (t: Transaction): Promise<Transaction> => await handler(t, socket, endpoint));
}

export abstract class Middleware {
	static concatenateHandlers(middlewares: Middleware[] = [], endpoint: Endpoint) {
		return (
			transaction: Transaction,
			socket: Socket,
			handler: (value: Transaction) => Promise<Transaction>
		): Promise<Transaction> => {
			const initialPromise = async (): Promise<Transaction> => transaction;
			let concatenated = initialPromise();
			for (const middleware of middlewares) {
				if (typeof middleware.beforeHook === 'function') {
					concatenated = concatenate(concatenated, middleware.beforeHook, socket, endpoint);
				}
			}
			concatenated = concatenated.then(handler);
			for (const middleware of middlewares) {
				if (typeof middleware.afterHook === 'function') {
					concatenated = concatenate(concatenated, middleware.afterHook, socket, endpoint);
				}
			}
			return concatenated;
		};
	}

	abstract name: string;

	beforeHook?(transaction: Transaction, socket: Socket, endpoint: Endpoint): Promise<Transaction>;
	afterHook?(transaction: Transaction, socket: Socket, endpoint: Endpoint): Promise<Transaction>;
}
