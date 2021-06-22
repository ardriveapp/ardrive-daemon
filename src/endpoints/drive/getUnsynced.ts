import { DriveData } from '../../constants';
import { getAllUnSyncedPersonalDrivesByLoginFromDriveTable } from '../../db_get';
import { SessionContext } from '../../service/SessionContext';
import { LOGIN } from '../../service/sessionContextKeys';
import { Endpoint } from '../Endpoint';
import { GET_UNSYNCED_DRIVES_ENDPOINT } from '../endpointNames';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';

interface GetUnsyncedDrivesRequest {
	drivePrivacy: 'private' | 'public';
}

export class GetUnsyncedDrivesEndpoint extends Endpoint {
	public name = GET_UNSYNCED_DRIVES_ENDPOINT;
	protected middlewares = [new AuthenticationMiddleware()];

	protected _clientHandler(result: DriveData[]): DriveData[] {
		return result;
	}

	protected async _serverHandler(request: GetUnsyncedDrivesRequest, context: SessionContext): Promise<DriveData[]> {
		const allDrives: DriveData[] = getAllUnSyncedPersonalDrivesByLoginFromDriveTable(
			context.get(LOGIN),
			request.drivePrivacy
		).map((d) => ({ driveName: d.driveName, driveId: d.driveId }));
		return allDrives;
	}

	public fire = async (drivePrivacy: 'private' | 'public'): Promise<boolean> => {
		const transactionInstance = this.clientSendData({ drivePrivacy });
		return await transactionInstance.promiseInstance;
	};
}
