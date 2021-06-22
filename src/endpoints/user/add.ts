import { addNewUser, ArDriveUser } from 'ardrive-core-js';
import { Endpoint } from '../Endpoint';

const BAD_USER = 'Bad user';

export class AddUserEndpoint extends Endpoint {
	public name = 'add-user';

	protected async _clientHandler(response: string): Promise<string> {
		if (response !== BAD_USER) {
			return response;
		}
		throw new Error(BAD_USER);
	}

	protected async _serverHandler(payload: string): Promise<string> {
		const user: ArDriveUser = JSON.parse(payload);
		// TODO: validate user
		const success = (await addNewUser(user.dataProtectionKey, user)) === 'Success';
		if (success) {
			return user.login;
		}
		return BAD_USER;
	}

	public fire = async (user: ArDriveUser): Promise<string> => {
		const data = JSON.stringify(user);
		const transactionInstance = this.clientSendData(data);
		return await transactionInstance.promiseInstance;
	};
}
