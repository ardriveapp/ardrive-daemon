// import { arfsNewDriveAndRootFolder } from 'ardrive-core-js';
import { ArDriveUser, ArFSDriveMetaData, createNewPrivateDrive, createNewPublicDrive } from 'ardrive-core-js';
import { addDriveToDriveTable } from '../../db_update';
import { SessionContext } from '../../service/SessionContext';
import { USER } from '../../service/sessionContextKeys';
import { Endpoint } from '../Endpoint';
import { ADD_DIVE_ENDPOINT } from '../endpointNames';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';

interface AddDriveRequest {
	driveName: string;
	isPrivate: boolean;
}

export class AddDriveEndpoint extends Endpoint {
	public name = ADD_DIVE_ENDPOINT;
	protected middlewares = [new AuthenticationMiddleware()];

	protected _clientHandler(response: string): string {
		return response;
	}

	protected async _serverHandler(request: AddDriveRequest, context: SessionContext): Promise<string> {
		const user: ArDriveUser = context.get(USER);
		let drive: ArFSDriveMetaData;
		if (request.isPrivate) {
			drive = await createNewPrivateDrive(user.login, request.driveName);
		} else {
			drive = await createNewPublicDrive(user.login, request.driveName);
		}
		await addDriveToDriveTable(drive);
		return drive.driveId;
	}

	public fire = async (driveName: string, isPublic = false, driveKey?: Buffer): Promise<string> => {
		if (isPublic && !driveKey) {
			throw new Error(`Private drives must have a key. Got ${driveKey}`);
		}
		const transactionInstance = this.clientSendData({ driveName, isPublic, driveKey });
		return await transactionInstance.promiseInstance;
	};
}
