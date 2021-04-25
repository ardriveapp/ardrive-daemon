import { Endpoint } from './Endpoint';
import { ECHO_ENDPOINT } from './endpointNames';

export class EchoEndpoint extends Endpoint {
	public name = ECHO_ENDPOINT;

	protected _clientHandler(response: any) {
		return response;
	}

	protected _serverHandler(payload: string) {
		return payload;
	}

	public fire = async (data: string): Promise<string> => {
		const transactionInstance = this.newTransaction();
		const transactionData = transactionInstance.serialize(data);
		this.clientEmmit(Buffer.from(transactionData));
		return await transactionInstance.promiseInstance;
	};
}
