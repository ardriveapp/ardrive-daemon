// import { arfsNewDriveAndRootFolder } from 'ardrive-core-js';
import { ArDriveUser, ArFSDriveMetaData, getSharedPublicDrive } from 'ardrive-core-js';
import { getAllUnSyncedPersonalDrivesByLoginFromDriveTable } from '../../db_get';
import { addDriveToDriveTable } from '../../db_update';
import { BadDrive } from '../../errors';
import { SessionContext } from '../../service/SessionContext';
import { Endpoint } from '../Endpoint';
import { IMPORT_DRIVE_ENDPOINT } from '../endpointNames';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';

interface ImportDriveRequest {
	driveId: string;
	isShared: boolean;
}

export class ImportDriveEndpoint extends Endpoint {
	public name = IMPORT_DRIVE_ENDPOINT;
	protected middlewares = [new AuthenticationMiddleware()];

	protected _clientHandler(driveId: string): string {
		return driveId;
	}

	protected async _serverHandler(request: ImportDriveRequest, context: SessionContext): Promise<string> {
		const user: ArDriveUser = context.get('user');
		let drive: ArFSDriveMetaData;
		if (request.isShared) {
			drive = await getSharedPublicDrive(request.driveId);
		} else {
			const unsyncedDrives = await getAllUnSyncedPersonalDrivesByLoginFromDriveTable(user.login, 'public');
			drive = unsyncedDrives.find((drive: ArFSDriveMetaData) => drive.driveId === request.driveId);
		}
		if (drive) {
			addDriveToDriveTable(drive);
			return drive.driveId;
		} else {
			throw new BadDrive();
		}
	}

	public fire = async (driveName: string, isPublic = false, driveKey?: Buffer): Promise<string> => {
		if (isPublic && !driveKey) {
			throw new Error(`Private drives must have a key. Got ${driveKey}`);
		}
		const transactionInstance = this.clientSendData({ driveName, isPublic, driveKey });
		return await transactionInstance.promiseInstance;
	};
}
