import ipc from "node-ipc";
import { SERVICE_NAME, SERVICE_PATH } from "../constants";
import { ALL_ENDPOINTS } from "../endpoints";
import { Endpoint } from "../endpoints/Endpoint";

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

  _setup = () => {
    ipc.config.appspace = SERVICE_NAME;
    ipc.config.socketRoot = "/tmp/";
    ipc.config.retry = 1500;
    this.endpoints.forEach((endpoint) => {
      ipc.server.on(endpoint.name, endpoint.getServerHandler());
    });
    ipc.server.on("socket.disconnected", function (_, destroyedSocketID) {
      ipc.log("client " + destroyedSocketID + " has disconnected!");
    });
    ipc.server.on("connect", (s) => {
      console.log(`Connected ${s}`);
    });
  };

  start() {
    ipc.server.start();
  }

  stop() {
    ipc.server.stop();
  }
}