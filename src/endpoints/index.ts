import { PingEndpoint } from "./ping";
import { MessageEndpoint } from "./message";
import { Endpoint } from "./Endpoint";

export const ALL_ENDPOINTS: Endpoint[] = [
  new PingEndpoint(),
  new MessageEndpoint(),
];
export const ALL_ENDPOINT_NAMES = ALL_ENDPOINTS.map((e) => e.name);

export { PingEndpoint, MessageEndpoint };
