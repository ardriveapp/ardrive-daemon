import { getUser, passwordCheck } from 'ardrive-core-js';
import { SessionContext } from '../../service/SessionContext';
import { AUTHENTICATED, LOGIN, USER } from '../../service/sessionContextKeys';
import { Endpoint } from '../Endpoint';

interface UserRequest {
	login: string;
	password: string;
}

export class AuthenticateUserEndpoint extends Endpoint {
	public name = 'authenticate-user';

	protected async _clientHandler(response: boolean): Promise<boolean> {
		return response;
	}

	protected async _serverHandler(request: UserRequest, context: SessionContext): Promise<boolean> {
		const authenticated = await passwordCheck(request.password, request.login);
		if (authenticated) {
			context.set(AUTHENTICATED, true);
			context.set(LOGIN, request.login);
			const user = await getUser(request.password, request.login);
			context.set(USER, user);
		}
		return authenticated;
	}

	public fire = async (login: string, password: string): Promise<boolean> => {
		const transaction = this.clientSendData({ login, password });
		return transaction.promiseInstance;
	};
}
