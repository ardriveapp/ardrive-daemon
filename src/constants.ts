import ipc from 'node-ipc';
import { Socket } from 'node:net';

export const SERVICE_NAME = 'ARDriveDaemon';
export const SERVICE_PATH = '/tmp/ARDriveDaemon.service';

export function getSocket(name: string): Socket {
	return ipc.of[name];
}

export interface SocketHandlerEvent {
	type: string;
	data: Buffer;
}

export class ErrorResponse {
	message = '';
}

export interface DriveData {
	driveName: string;
	driveId: string;
}

export const DATABASE_PATH = './.ardrive-cli.db';
