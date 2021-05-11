import { Socket } from 'net';
import { AuthenticationError } from '../../errors';
import { SessionContext } from '../../service/SessionContext';
import { AUTHENTICATED, LOGIN } from '../../service/sessionContextKeys';
import { Transaction } from '../Endpoint';
import { Middleware } from './Middleware';

export class AuthenticationMiddleware extends Middleware {
	name = 'AuthenticationMiddleware';

	async beforeHook(transaction: Transaction, socket: Socket): Promise<Transaction> {
		const context = new SessionContext(socket);
		const authenticated = context.get(AUTHENTICATED) && context.get(LOGIN);
		if (!authenticated) {
			throw new AuthenticationError();
		}
		return transaction;
	}
}
