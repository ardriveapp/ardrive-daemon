import { ARDriveDaemon } from "./service";

let instance: ARDriveDaemon;

if (require.main === module) {
  instance = new ARDriveDaemon();
  instance.start();
}
