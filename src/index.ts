import { ARDriveDaemon } from './service';

export * from './client';
export * from './errors';

let instance: ARDriveDaemon;

if (require.main === module) {
	instance = new ARDriveDaemon();
	instance.start();
}
