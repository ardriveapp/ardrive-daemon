import { Socket } from 'net';
import ipc from 'node-ipc';
import { SERVICE_NAME, SERVICE_PATH } from '../constants';
import { ALL_ENDPOINTS } from '../endpoints';
import { Endpoint } from '../endpoints/Endpoint';
import { getSocket } from '../constants';

export class ClientService {
	static instance: ClientService;
	socket?: Socket;
	private endpoints: Endpoint[] = ALL_ENDPOINTS;
	private connectPromise?: Promise<void>;

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
			this.connectPromise = new Promise((resolve) => {
				ipc.connectTo(SERVICE_NAME, SERVICE_PATH, () => {
					resolve();
					this._setupHandlers();
				});
			});
		}
		return this.connectPromise;
	};

	disconnect = async (): Promise<void> => {
		await ipc.disconnect(SERVICE_NAME);
	};

	isConnected(): boolean {
		return !!this.socket;
	}

	_setupHandlers = (): void => {
		const socket = getSocket(SERVICE_NAME);
		this.socket = socket;
		if (!socket) {
			console.error(`There's no socket!`);
			return;
		}
		for (const endpoint of this.endpoints) {
			socket.on(endpoint.name, endpoint.getClientHandler());
		}
		socket.on('socket.disconnected', function (_, destroyedSocketID) {
			ipc.log('Server ' + destroyedSocketID + ' has disconnected!');
		});
	};

	run = async <T>(endpointName: string, data: string): Promise<T> => {
		const endpoint = this._findEndpoint(endpointName);
		console.info(`Firing ${endpoint?.name}`);
		const tmp = endpoint?.fire(data);
		return (await tmp) as T;
	};

	_findEndpoint(endpointName: string): Endpoint | undefined {
		return this.endpoints.find((e) => e.name === endpointName);
	}
}
