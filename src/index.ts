<<<<<<< HEAD
import { ARDriveDaemon } from "./service";

let instance: ARDriveDaemon;

if (require.main === module) {
  instance = new ARDriveDaemon();
  instance.start();
}
=======
export * from './common';
export * from './download';
export * from './files';
export * from './upload';
export * from './profile';
export { setupDatabase } from './db';
export {
	getUserFromProfileById,
	getUserFromProfile,
	getMyFileDownloadConflicts,
	getDriveFromDriveTable,
	getAllDrivesByLoginFromDriveTable,
	getAllUnSyncedPersonalDrivesByLoginFromDriveTable,
	getProfileWalletBalance
} from './db_get';
export { setProfileWalletBalance, setDriveToSync, addDriveToDriveTable, setProfileAutoSyncApproval } from './db_update';
>>>>>>> dev
