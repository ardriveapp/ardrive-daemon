import * as fs from 'fs';
import * as common from './common';
import * as getDb from './db_get';
import * as updateDb from './db_update';
import * as core from 'ardrive-core-js';
import path, { dirname } from 'path';
import { createWriteStream } from 'fs';
import Axios from 'axios';
import ProgressBar from 'progress';

// Downloads a single file from ArDrive by transaction
async function downloadArDriveFileByTx(user: core.ArDriveUser, fileToDownload: core.ArFSFileMetaData) {
	try {
		// Get the parent folder's path
		const parentFolder: core.ArFSFileMetaData = await getDb.getLatestFolderVersionFromSyncTable(
			fileToDownload.parentFolderId
		);

		// Check if this file's path has the right path from its parent folder.  This ensures folders moved on the web are properly moved locally
		if (parentFolder.filePath !== path.dirname(fileToDownload.filePath)) {
			// Update the file path in the database
			console.log('Fixing file path to ', parentFolder.filePath);
			fileToDownload.filePath = path.join(parentFolder.filePath, fileToDownload.fileName);
			await updateDb.setFilePath(fileToDownload.filePath, fileToDownload.id);
		}

		// Check if this is a folder.  If it is, we dont need to download anything and we create the folder.
		const folderPath = dirname(fileToDownload.filePath);
		if (!fs.existsSync(folderPath)) {
			fs.mkdirSync(folderPath, { recursive: true });
			await common.sleep(100);
		}

		const dataTxUrl = common.gatewayURL.concat(fileToDownload.dataTxId);
		// Public files do not need decryption
		if (+fileToDownload.isPublic === 1) {
			console.log('Downloading %s', fileToDownload.filePath);
			const writer = createWriteStream(fileToDownload.filePath);
			const response = await Axios({
				method: 'get',
				url: dataTxUrl,
				responseType: 'stream'
			});
			const totalLength = response.headers['content-length'];
			const progressBar = new ProgressBar('-> [:bar] :rate/bps :percent :etas', {
				width: 40,
				complete: '=',
				incomplete: ' ',
				renderThrottle: 1,
				total: parseInt(totalLength)
			});

			response.data.on('data', (chunk: string | any[]) => progressBar.tick(chunk.length));
			response.data.pipe(writer);

			return new Promise((resolve, reject) => {
				writer.on('error', (err) => {
					writer.close();
					reject(err);
				});
				writer.on('close', () => {
					console.log('   Completed!', fileToDownload.filePath);
					resolve(true);
				});
			});
		} else {
			// File is private and we must decrypt it
			console.log('Downloading and decrypting %s', fileToDownload.filePath);
			const writer = createWriteStream(fileToDownload.filePath);
			const response = await Axios({
				method: 'get',
				url: dataTxUrl,
				responseType: 'stream'
			});
			const totalLength = response.headers['content-length'];
			const progressBar = new ProgressBar('-> [:bar] :rate/bps :percent :etas', {
				width: 40,
				complete: '=',
				incomplete: ' ',
				renderThrottle: 1,
				total: parseInt(totalLength)
			});

			response.data.on('data', (chunk: string | any[]) => progressBar.tick(chunk.length));
			response.data.pipe(writer);

			return new Promise((resolve, reject) => {
				writer.on('error', (err) => {
					writer.close();
					console.log(user);
					reject(err);
				});
				writer.on('close', async () => {
					// Once the file is finished being streamed, we read it and decrypt it.
					const data = fs.readFileSync(fileToDownload.filePath);
					const dataBuffer = Buffer.from(data);
					const driveKey: Buffer = await core.deriveDriveKey(
						user.dataProtectionKey,
						fileToDownload.driveId,
						user.walletPrivateKey
					);
					const fileKey: Buffer = await core.deriveFileKey(fileToDownload.fileId, driveKey);
					const decryptedData = await core.fileDecrypt(fileToDownload.dataCipherIV, fileKey, dataBuffer);

					// Overwrite the file with the decrypted version
					fs.writeFileSync(fileToDownload.filePath, decryptedData);
					console.log('   Completed!', fileToDownload.filePath);
					resolve(true);
				});
			});
		}
	} catch (err) {
		//console.log(err);
		console.log('Error downloading file data %s to %s', fileToDownload.fileName, fileToDownload.filePath);
		return 'Error downloading file';
	}
}

// Takes an ArDrive File Data Transaction and writes to the database.
async function getFileMetaDataFromTx(fileDataTx: core.GQLEdgeInterface, user: core.ArDriveUser) {
	const fileToSync: core.ArFSFileMetaData = {
		id: 0,
		login: user.login,
		appName: '',
		appVersion: '',
		unixTime: 0,
		contentType: '',
		entityType: '',
		driveId: '',
		parentFolderId: '',
		fileId: '',
		fileSize: 0,
		fileName: '',
		fileHash: '',
		filePath: '',
		fileVersion: 0,
		lastModifiedDate: 0,
		isPublic: 0,
		isLocal: 0,
		fileDataSyncStatus: 0,
		fileMetaDataSyncStatus: 0,
		permaWebLink: '',
		metaDataTxId: '',
		dataTxId: '',
		cipher: '',
		dataCipherIV: '',
		metaDataCipherIV: '',
		cloudOnly: 0
	};
	try {
		const { node } = fileDataTx;
		const { tags } = node;
		fileToSync.metaDataTxId = node.id;

		// DOUBLE CHECK THIS
		// Is the File or Folder already present in the database?  If it is, lets ensure its already downloaded
		const isMetaDataSynced = await getDb.getByMetaDataTxFromSyncTable(fileToSync.metaDataTxId);
		if (isMetaDataSynced) {
			// this file is already downloaded and synced
			return 'Synced Already';
		}

		// Download the File's Metadata using the metadata transaction ID
		const data: string | Uint8Array = await core.getTransactionData(fileToSync.metaDataTxId);

		// Enumerate through each tag to pull the data
		tags.forEach((tag: core.GQLTagInterface) => {
			const key = tag.name;
			const { value } = tag;
			switch (key) {
				case 'App-Name':
					fileToSync.appName = value;
					break;
				case 'App-Version':
					fileToSync.appVersion = value;
					break;
				case 'Unix-Time':
					fileToSync.unixTime = +value; // Convert to number
					break;
				case 'Content-Type':
					fileToSync.contentType = value;
					break;
				case 'Entity-Type':
					fileToSync.entityType = value;
					break;
				case 'Drive-Id':
					fileToSync.driveId = value;
					break;
				case 'File-Id':
					fileToSync.fileId = value;
					break;
				case 'Folder-Id':
					fileToSync.fileId = value;
					break;
				case 'Parent-Folder-Id':
					fileToSync.parentFolderId = value;
					break;
				case 'Cipher':
					fileToSync.cipher = value;
					break;
				case 'Cipher-IV':
					fileToSync.metaDataCipherIV = value;
					break;
				default:
					break;
			}
		});

		let dataJSON;
		let decryptedData = Buffer.from('');
		// If it is a private file or folder, the data will need decryption.
		if (fileToSync.cipher === 'AES256-GCM') {
			fileToSync.isPublic = 0;
			const dataBuffer = Buffer.from(data);
			const driveKey: Buffer = await core.deriveDriveKey(
				user.dataProtectionKey,
				fileToSync.driveId,
				user.walletPrivateKey
			);
			if (fileToSync.entityType === 'file') {
				// Decrypt files using a File Key derived from the Drive key
				const fileKey: Buffer = await core.deriveFileKey(fileToSync.fileId, driveKey);
				decryptedData = await core.fileDecrypt(fileToSync.metaDataCipherIV, fileKey, dataBuffer);
			} else if (fileToSync.entityType === 'folder') {
				// Decrypt folders using the Drive Key only
				decryptedData = await core.fileDecrypt(fileToSync.metaDataCipherIV, driveKey, dataBuffer);
			}

			// Handle an error with decryption by ignoring this file.  THIS NEEDS TO BE IMPROVED.
			if (decryptedData.toString('ascii') === 'Error') {
				console.log(
					'There was a problem decrypting a private %s with TXID: %s',
					fileToSync.entityType,
					fileToSync.metaDataTxId
				);
				console.log('Skipping this file...');
				fileToSync.fileSize = 0;
				fileToSync.fileName = '';
				fileToSync.fileHash = '';
				fileToSync.fileDataSyncStatus = 0;
				fileToSync.fileMetaDataSyncStatus = 3;
				fileToSync.dataTxId = '0';
				fileToSync.lastModifiedDate = fileToSync.unixTime;
				fileToSync.permaWebLink = common.gatewayURL.concat(fileToSync.dataTxId);
				fileToSync.cloudOnly = 1;
				await updateDb.addFileToSyncTable(fileToSync); // This must be handled better.
				return 'Error Decrypting';
			} else {
				const dataString = await common.Utf8ArrayToStr(decryptedData);
				dataJSON = await JSON.parse(dataString);
			}
		} else {
			// the file is public and does not require decryption
			const dataString = await common.Utf8ArrayToStr(data);
			dataJSON = await JSON.parse(dataString);
			fileToSync.isPublic = 1;
		}

		// Set metadata for Folder and File entities
		fileToSync.fileSize = dataJSON.size;
		fileToSync.fileName = dataJSON.name;
		fileToSync.fileHash = '';
		fileToSync.fileDataSyncStatus = 3;
		fileToSync.fileMetaDataSyncStatus = 3;
		fileToSync.dataTxId = '0';

		// Perform specific actions for File, Folder and Drive entities
		if (fileToSync.entityType === 'file') {
			// The actual data transaction ID, lastModifiedDate, and Filename of the underlying file are pulled from the metadata transaction
			fileToSync.lastModifiedDate = dataJSON.lastModifiedDate; // Convert to milliseconds
			fileToSync.dataTxId = dataJSON.dataTxId;
			fileToSync.contentType = common.extToMime(dataJSON.name);
			fileToSync.permaWebLink = common.gatewayURL.concat(dataJSON.dataTxId);

			if (fileToSync.isPublic === 0) {
				// if this is a private file, the CipherIV of the Data transaction should also be captured
				fileToSync.dataCipherIV = await core.getPrivateTransactionCipherIV(fileToSync.dataTxId);
			}

			// Check to see if a previous version exists, and if so, increment the version.
			// Versions are determined by comparing old/new file hash.
			const latestFile = await getDb.getLatestFileVersionFromSyncTable(fileToSync.fileId);
			if (latestFile !== undefined) {
				if (latestFile.fileDataTx !== fileToSync.dataTxId) {
					fileToSync.fileVersion = +latestFile.fileVersion + 1;
					// console.log ("%s has a new version %s", dataJSON.name, fileToSync.fileVersion)
				}
				// If the previous file data tx matches, then we do not increment the version
				else {
					fileToSync.fileVersion = latestFile.fileVersion;
				}
			}
			// Perform specific actions for Folder entities
		} else if (fileToSync.entityType === 'folder') {
			fileToSync.lastModifiedDate = fileToSync.unixTime;
			fileToSync.permaWebLink = common.gatewayURL.concat(fileToSync.metaDataTxId);
		}

		console.log(
			'QUEUING %s %s | Id: %s | Tx: %s for download',
			fileToSync.entityType,
			fileToSync.fileName,
			fileToSync.fileId,
			fileToSync.metaDataTxId
		);
		await updateDb.addFileToSyncTable(fileToSync);
		return 'Success';
	} catch (err) {
		console.log(err);
		console.log('Error syncing file metadata');
		console.log(fileToSync);
		return 'Error syncing file metadata';
	}
}

// Gets all of the files from your ArDrive (via ARQL) and loads them into the database.
export async function getMyArDriveFilesFromPermaWeb(user: core.ArDriveUser): Promise<string> {
	// Get your private files
	console.log('---Getting all your Private ArDrive files---');
	let drives: core.ArFSDriveMetaData[] = await getDb.getAllDrivesByPrivacyFromDriveTable(
		user.login,
		'personal',
		'private'
	);
	await common.asyncForEach(drives, async (drive: core.ArFSDriveMetaData) => {
		// Get the last block height that has been synced
		let lastBlockHeight = await getDb.getDriveLastBlockHeight(drive.driveId);
		lastBlockHeight = lastBlockHeight.lastBlockHeight;
		const privateTxIds = await core.getAllMyDataFileTxs(user.walletPublicKey, drive.driveId, lastBlockHeight);
		if (privateTxIds !== undefined) {
			await common.asyncForEach(privateTxIds, async (privateTxId: core.GQLEdgeInterface) => {
				await getFileMetaDataFromTx(privateTxId, user);
			});
		}
		// Get and set the latest block height for each drive synced
		const latestBlockHeight: number = await core.getLatestBlockHeight();
		await updateDb.setDriveLastBlockHeight(latestBlockHeight, drive.driveId);
	});

	// Get your public files
	console.log('---Getting all your Public ArDrive files---');
	drives = await getDb.getAllDrivesByPrivacyFromDriveTable(user.login, 'personal', 'public');
	await common.asyncForEach(drives, async (drive: core.ArFSDriveMetaData) => {
		// Get the last block height that has been synced
		let lastBlockHeight = await getDb.getDriveLastBlockHeight(drive.driveId);
		lastBlockHeight = lastBlockHeight.lastBlockHeight;
		const publicTxIds = await core.getAllMyDataFileTxs(user.walletPublicKey, drive.driveId, lastBlockHeight);
		if (publicTxIds !== undefined) {
			await common.asyncForEach(publicTxIds, async (publicTxId: core.GQLEdgeInterface) => {
				await getFileMetaDataFromTx(publicTxId, user);
			});
		}
		// Get and set the latest block height for each drive synced
		const latestBlockHeight: number = await core.getLatestBlockHeight();
		await updateDb.setDriveLastBlockHeight(latestBlockHeight, drive.driveId);
	});

	// Get your shared public files
	console.log('---Getting all your Shared Public ArDrive files---');
	drives = await getDb.getAllDrivesByPrivacyFromDriveTable(user.login, 'shared', 'public');
	await common.asyncForEach(drives, async (drive: core.ArFSDriveMetaData) => {
		// Get the last block height that has been synced
		let lastBlockHeight = await getDb.getDriveLastBlockHeight(drive.driveId);
		lastBlockHeight = lastBlockHeight.lastBlockHeight;
		const sharedPublicTxIds = await core.getAllMySharedDataFileTxs(drive.driveId, lastBlockHeight);
		if (sharedPublicTxIds !== undefined) {
			await common.asyncForEach(sharedPublicTxIds, async (sharedPublicTxId: core.GQLEdgeInterface) => {
				await getFileMetaDataFromTx(sharedPublicTxId, user);
			});
		}
		// Get and set the latest block height for each drive synced
		const latestBlockHeight: number = await core.getLatestBlockHeight();
		await updateDb.setDriveLastBlockHeight(latestBlockHeight, drive.driveId);
	});

	// File path is not present by default, so we must generate them for each new file, folder or drive found
	await common.setNewFilePaths();
	return 'Success';
}

// Downloads all ardrive files that are not local
export async function downloadMyArDriveFiles(user: core.ArDriveUser): Promise<string> {
	console.log('---Downloading any unsynced files---');
	// Get the Files and Folders which have isLocal set to 0 that we are not ignoring
	const filesToDownload: core.ArFSFileMetaData[] = await getDb.getFilesToDownload(user.login);
	const foldersToCreate: core.ArFSFileMetaData[] = await getDb.getFoldersToCreate(user.login);

	// Get the special batch of File Download Conflicts
	const fileConflictsToDownload: core.ArFSFileMetaData[] = await getDb.getMyFileDownloadConflicts(user.login);

	// Process any folders to create
	if (foldersToCreate.length > 0) {
		// there are new folders to create
		await common.asyncForEach(foldersToCreate, async (folderToCreate: core.ArFSFileMetaData) => {
			// Establish the folder path first
			if (folderToCreate.filePath === '') {
				folderToCreate.filePath = await common.updateFilePath(folderToCreate);
			}
			// Get the latest folder version from the DB
			const latestFolderVersion: core.ArFSFileMetaData = await getDb.getLatestFolderVersionFromSyncTable(
				folderToCreate.fileId
			);
			// If this folder is the latest version, then we should create the folder
			try {
				if (latestFolderVersion.filePath === folderToCreate.filePath) {
					// Compare against the previous version for a different file name or parent folder
					// If it does then this means there was a rename or move, and then we do not download a new file, rather rename/move the old
					const previousFolderVersion: core.ArFSFileMetaData = await getDb.getPreviousFileVersionFromSyncTable(
						folderToCreate.fileId
					);
					// If undefined, then there is no previous folder version.
					if (previousFolderVersion === undefined) {
						if (!fs.existsSync(folderToCreate.filePath)) {
							console.log('Creating new folder from permaweb %s', folderToCreate.filePath);
							fs.mkdirSync(folderToCreate.filePath);
						}
					} else if (
						+previousFolderVersion.isLocal === 1 &&
						(folderToCreate.fileName !== previousFolderVersion.fileName ||
							folderToCreate.parentFolderId !== previousFolderVersion.parentFolderId)
					) {
						// There is a previous folder version, so we must rename/move it to the latest file path
						// Need error handling here in case file is in use
						fs.renameSync(previousFolderVersion.filePath, folderToCreate.filePath);

						// All children of the folder need their paths update in the database
						await common.setFolderChildrenPaths(folderToCreate);

						// Change the older version to not local/ignored since it has been renamed or moved
						await updateDb.updateFileDownloadStatus('0', previousFolderVersion.id); // Mark older version as not local
						await updateDb.setPermaWebFileToCloudOnly(previousFolderVersion.id); // Mark older version as ignored
					} else if (!fs.existsSync(folderToCreate.filePath)) {
						console.log('Creating new folder from permaweb %s', folderToCreate.filePath);
						fs.mkdirSync(folderToCreate.filePath);
					}
					await updateDb.updateFileDownloadStatus('1', folderToCreate.id);
				} else {
					// This is an older version, and we ignore it for now.
					await updateDb.updateFileDownloadStatus('0', folderToCreate.id); // Mark older fodler version as not local and ignored
					await updateDb.setPermaWebFileToCloudOnly(folderToCreate.id); // Mark older folder version as ignored
				}
			} catch (err) {
				// console.log (err)
			}
		});
	}
	// Process any files to download
	if (filesToDownload.length > 0) {
		// There are unsynced files to process
		await common.asyncForEach(filesToDownload, async (fileToDownload: core.ArFSFileMetaData) => {
			// Establish the file path first
			if (fileToDownload.filePath === '') {
				fileToDownload.filePath = await common.updateFilePath(fileToDownload);
			}
			// Get the latest file version from the DB so we can download them.  Versions that are not the latest will not be downloaded.
			const latestFileVersion: core.ArFSFileMetaData = await getDb.getLatestFileVersionFromSyncTable(
				fileToDownload.fileId
			);
			try {
				// Check if this file is the latest version
				if (fileToDownload.id === latestFileVersion.id) {
					// Compare against the previous version for a different file name or parent folder
					// If it does then this means there was a rename or move, and then we do not download a new file, rather rename/move the old
					const previousFileVersion: core.ArFSFileMetaData = await getDb.getPreviousFileVersionFromSyncTable(
						fileToDownload.fileId
					);

					// If undefined, then there is no previous file version.
					if (previousFileVersion === undefined) {
						// Does this exact file already exist locally?  If not, then we download it
						if (!common.checkFileExistsSync(fileToDownload.filePath)) {
							// File is not local, so we download and decrypt if necessary
							// UPDATE THIS TO NOT TRY TO SET LOCAL TIME
							await downloadArDriveFileByTx(user, fileToDownload);
							const currentDate = new Date();
							const lastModifiedDate = new Date(Number(fileToDownload.lastModifiedDate));
							fs.utimesSync(fileToDownload.filePath, currentDate, lastModifiedDate);
						} else {
							console.log('%s is already local, skipping download', fileToDownload.filePath);
						}
					}
					// Check if this is an older version i.e. same file name/parent folder.
					else if (
						+previousFileVersion.isLocal === 1 &&
						(fileToDownload.fileName !== previousFileVersion.fileName ||
							fileToDownload.parentFolderId !== previousFileVersion.parentFolderId)
					) {
						// Need error handling here in case file is in use
						fs.renameSync(previousFileVersion.filePath, fileToDownload.filePath);

						// Change the older version to not local/ignored since it has been renamed or moved
						await updateDb.updateFileDownloadStatus('0', previousFileVersion.id); // Mark older version as not local
						await updateDb.setPermaWebFileToCloudOnly(previousFileVersion.id); // Mark older version as ignored
						// This is a new file version
					} else {
						// Does this exact file already exist locally?  If not, then we download it
						if (
							!common.checkExactFileExistsSync(fileToDownload.filePath, fileToDownload.lastModifiedDate)
						) {
							// Download and decrypt the file if necessary
							await downloadArDriveFileByTx(user, fileToDownload);
							const currentDate = new Date();
							const lastModifiedDate = new Date(Number(fileToDownload.lastModifiedDate));
							fs.utimesSync(fileToDownload.filePath, currentDate, lastModifiedDate);
						} else {
							console.log('%s is already local, skipping download', fileToDownload.filePath);
						}
					}

					// Hash the file and update it in the database
					const fileHash = await core.checksumFile(fileToDownload.filePath);
					await updateDb.updateFileHashInSyncTable(fileHash, fileToDownload.id);

					// Update the file's local status in the database
					await updateDb.updateFileDownloadStatus('1', fileToDownload.id);

					return 'Downloaded';
				} else {
					// This is an older version, and we ignore it for now.
					await updateDb.updateFileDownloadStatus('0', fileToDownload.id); // Mark older version as not local
					await updateDb.setPermaWebFileToCloudOnly(fileToDownload.id); // Mark older version as ignored
				}
				return 'Checked file';
			} catch (err) {
				// console.log (err)
				console.log('Error downloading file %s to %s', fileToDownload.fileName, fileToDownload.filePath);
				return 'Error downloading file';
			}
		});
	}
	// Process any previously conflicting file downloads
	if (fileConflictsToDownload.length > 0) {
		await common.asyncForEach(fileConflictsToDownload, async (fileConflictToDownload: core.ArFSFileMetaData) => {
			// This file is on the Permaweb, but it is not local or the user wants to overwrite the local file
			console.log('Overwriting local file %s', fileConflictToDownload.filePath);
			await downloadArDriveFileByTx(user, fileConflictToDownload);
			// Ensure the file downloaded has the same lastModifiedDate as before
			const currentDate = new Date();
			const lastModifiedDate = new Date(Number(fileConflictToDownload.lastModifiedDate));
			fs.utimesSync(fileConflictToDownload.filePath, currentDate, lastModifiedDate);
			await updateDb.updateFileDownloadStatus('1', fileConflictToDownload.id);
			return 'File Overwritten';
		});
	}

	// Run some other processes to ensure downloaded files are set properly
	await common.setAllFolderHashes();
	await common.setAllFileHashes();
	await common.setAllParentFolderIds();
	await common.setAllFolderSizes();
	await common.checkForMissingLocalFiles();

	return 'Downloaded all ArDrive files';
}

// Gets all Private and Public Drives associated with a user profile and adds to the database
export async function getAllMyPersonalDrives(user: core.ArDriveUser): Promise<core.ArFSDriveMetaData[]> {
	console.log('---Getting all your Personal Drives---');
	// Get the last block height that has been synced
	let lastBlockHeight = await getDb.getProfileLastBlockHeight(user.login);
	let privateDrives: core.ArFSDriveMetaData[] = [];
	let publicDrives: core.ArFSDriveMetaData[] = [];

	// If undefined, by default we sync from block 0
	if (lastBlockHeight === undefined) {
		lastBlockHeight = 0;
	} else {
		lastBlockHeight = lastBlockHeight.lastBlockHeight;
	}

	// Get all private and public drives since last block height
	try {
		privateDrives = await core.getAllMyPrivateArDriveIds(user, lastBlockHeight);
		if (privateDrives.length > 0) {
			await common.asyncForEach(privateDrives, async (privateDrive: core.ArFSDriveMetaData) => {
				const isDriveMetaDataSynced = await getDb.getDriveFromDriveTable(privateDrive.driveId);
				if (!isDriveMetaDataSynced) {
					await updateDb.addDriveToDriveTable(privateDrive);
				}
			});
		}
		publicDrives = await core.getAllMyPublicArDriveIds(user.login, user.walletPublicKey, lastBlockHeight);
		if (publicDrives.length > 0) {
			await common.asyncForEach(publicDrives, async (publicDrive: core.ArFSDriveMetaData) => {
				const isDriveMetaDataSynced = await getDb.getDriveFromDriveTable(publicDrive.driveId);
				if (!isDriveMetaDataSynced) {
					await updateDb.addDriveToDriveTable(publicDrive);
				}
			});
		}
		// Get and set the latest block height for the profile that has been synced
		const latestBlockHeight: number = await core.getLatestBlockHeight();
		await updateDb.setProfileLastBlockHeight(latestBlockHeight, user.login);

		return publicDrives.concat(privateDrives);
	} catch (err) {
		console.log(err);
		console.log('Error getting all Personal Drives');
		return publicDrives;
	}
}
