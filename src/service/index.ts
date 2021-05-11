import ipc from 'node-ipc';
import { DATABASE_PATH, SERVICE_NAME, SERVICE_PATH } from '../constants';
import { ALL_ENDPOINTS } from '../endpoints';
import { Endpoint } from '../endpoints/Endpoint';
import { setupDatabase } from '../db';
import { SessionContext } from './SessionContext';

let instance: ARDriveDaemon;

export class ARDriveDaemon {
	private endpoints: Endpoint[] = ALL_ENDPOINTS;

	constructor() {
		if (!instance) {
			instance = this;
			ipc.serve(SERVICE_PATH, this._setup);
		}
		return instance as ARDriveDaemon;
	}

	_setup = (): void => {
		ipc.config.appspace = SERVICE_NAME;
		ipc.config.socketRoot = '/tmp/';
		ipc.config.retry = 1500;
		this.endpoints.forEach((endpoint) => {
			ipc.log(`Listening for ${endpoint.name}...`);
			ipc.server.on(endpoint.name, endpoint.getServerHandler());
		});
		ipc.server.on('socket.disconnected', SessionContext.refreshInstances);
		ipc.server.on('connect', SessionContext.refreshInstances);
		// TODO: Uncomment when node-ipc updates event-pubsub dependency [node-ipc issue #191](https://github.com/RIAEvangelist/node-ipc/issues/191)
		// ipc.server.on('*', (e: any, socket: Socket) => {
		// 	const isReservedEvent = !e || e instanceof Error || !!e._server || e instanceof Buffer;
		// 	if (!isReservedEvent) {
		// 		const isHandledEvent = this.endpoints.map((e: Endpoint) => e.name).includes(e.type);
		// 		if (!isHandledEvent) {
		// 			const errorMessage = `Unsupported event: ${e.type}`;
		// 			socket.emit('error', { message: errorMessage });
		// 		}
		// 	}
		// });
		setupDatabase(DATABASE_PATH);
	};

	start(): void {
		ipc.server.start();
	}

	stop(): void {
		ipc.server.stop();
	}
}
