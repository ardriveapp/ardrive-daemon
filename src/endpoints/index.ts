import { PingEndpoint } from './ping';
import { AddUserEndpoint } from './user';
import { Endpoint } from './Endpoint';

export const ALL_ENDPOINTS: Endpoint[] = [new PingEndpoint(), new AddUserEndpoint()];
export const ALL_ENDPOINT_NAMES = ALL_ENDPOINTS.map((e) => e.name);

export { PingEndpoint, AddUserEndpoint };
