import { Endpoint } from '../Endpoint';
import { createArDriveWallet, Wallet } from 'ardrive-core-js';
import { CREATE_WALLET_ENDPOINT } from '../endpointNames';

/* FIXME:
 * wallets must be completely handled by daemon, there should be no need to allow user to get it
 */

export class CreateWalletEndpoint extends Endpoint {
	public name = CREATE_WALLET_ENDPOINT;

	protected async _clientHandler(response: string): Promise<Wallet> {
		const wallet: Wallet = JSON.parse(response);
		return wallet;
	}

	protected async _serverHandler(): Promise<string> {
		const wallet = await createArDriveWallet();
		return JSON.stringify(wallet);
	}

	public fire = async (): Promise<Wallet> => {
		const transactionInstance = this.newTransaction();
		const transactionData = transactionInstance.serialize();
		this.clientEmmit(Buffer.from(transactionData));
		return await transactionInstance.promiseInstance;
	};
}
