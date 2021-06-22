import { Socket } from 'net';
import ipc from 'node-ipc';
import { ErrorResponse, SERVICE_NAME, SERVICE_PATH } from '../constants';
import {
	ADD_DIVE_ENDPOINT,
	ADD_USER_ENDPOINT,
	ALL_ENDPOINTS,
	AUTHENTICATE_USER,
	CREATE_WALLET_ENDPOINT,
	ECHO_ENDPOINT,
	GET_UNSYNCED_DRIVES_ENDPOINT
} from '../endpoints';
import { Endpoint } from '../endpoints/Endpoint';
import { getSocket } from '../constants';
import { ArDriveUser, Wallet } from 'ardrive-core-js';
import { DriveData } from '../constants';
import { AuthenticationError } from '../errors';

export class ClientService {
	static instance: ClientService;
	socket?: Socket;
	private endpoints: Endpoint[] = ALL_ENDPOINTS;
	private connectPromise?: Promise<void>;
	private authenticated = false;

	constructor() {
		if (!ClientService.instance) {
			ipc.config.appspace = SERVICE_NAME;
			ipc.config.socketRoot = '/tmp/';
			ipc.config.retry = 500;
			ipc.config.maxRetries = 5;
			ipc.config.silent = true;
			ClientService.instance = this;
		}
		return ClientService.instance;
	}

	public clientConnect = (): Promise<void> => {
		if (this.socket) {
			const alreadyConnected: Promise<void> = new Promise((r) => r());
			return alreadyConnected;
		}
		if (!this.connectPromise) {
			this.connectPromise = new Promise((resolve, reject) => {
				ipc.connectTo(SERVICE_NAME, SERVICE_PATH, () => {
					this._setupHandlers();
					this.socket?.once('connect', () => {
						this.socket?.off('error', reject);
						resolve();
					});
					this.socket?.once('error', reject);
				});
			});
		}
		return this.connectPromise;
	};

	public disconnect = async (): Promise<void> => {
		await ipc.disconnect(SERVICE_NAME);
	};

	public isConnected(): boolean {
		return !!this.socket;
	}

	private _setupHandlers = (): void => {
		const socket = getSocket(SERVICE_NAME);
		this.socket = socket;
		if (!socket) {
			throw new Error("There's no socket!");
		}
		for (const endpoint of this.endpoints) {
			socket.on(endpoint.name, endpoint.getClientHandler());
		}
		socket.on('error', (e: ErrorResponse | any) => {
			if (e instanceof Error) {
				console.error(e.message);
			}
		});
		socket.on('socket.disconnected', function () {
			ipc.log('Server has disconnected');
		});
	};

	// eslint-disable-next-line
	public run = async <T>(endpointName: string, ...args: any): Promise<T> => {
		const endpoint = this._findEndpoint(endpointName);
		if (endpoint?.requiresAuthentication && !this.authenticated) {
			throw new AuthenticationError();
		}
		const tmp = endpoint?.fire(...args);
		return (await tmp) as T;
	};

	private _findEndpoint = (endpointName: string): Endpoint | undefined => {
		return this.endpoints.find((e: Endpoint) => e.name === endpointName);
	};

	public isOnline = async (): Promise<boolean> => {
		const message = 'ping';
		const echo = await this.run<string>(ECHO_ENDPOINT, message);
		return message === echo;
	};

	public createArDriveWallet = async (): Promise<Wallet> => {
		const wallet: Wallet = await this.run<Wallet>(CREATE_WALLET_ENDPOINT);
		return wallet;
	};

	public createArDriveUser = async (
		login: string,
		password: string,
		wallet: Wallet,
		syncFolderPath: string,
		autoSyncApproval: boolean
	): Promise<string> => {
		const user: ArDriveUser = {
			login,
			dataProtectionKey: password,
			walletPrivateKey: JSON.stringify(wallet.walletPrivateKey),
			walletPublicKey: wallet.walletPublicKey,
			syncFolderPath,
			autoSyncApproval: autoSyncApproval ? 1 : 0
		};
		return await this.run<string>(ADD_USER_ENDPOINT, user);
	};

	public authenticateArDriveUser = async (login: string, password: string): Promise<boolean> => {
		const authenticated = await this.run<boolean>(AUTHENTICATE_USER, login, password);
		if (authenticated) {
			this.authenticated = true;
		}
		return authenticated;
	};

	public getUnsyncedDrives = async (login: string, drivePrivacy: 'private' | 'public'): Promise<DriveData[]> => {
		return await this.run<DriveData[]>(GET_UNSYNCED_DRIVES_ENDPOINT, login, drivePrivacy);
	};

	public createArDrive = async (driveName: string, isPublic = false): Promise<string> => {
		// Returns the new drive id
		return await this.run<string>(ADD_DIVE_ENDPOINT, driveName, isPublic);
	};
}
