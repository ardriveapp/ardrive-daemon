import { EchoEndpoint } from './echo';
import { AddUserEndpoint } from './user';
import { CreateWalletEndpoint } from './wallet';
import { Endpoint } from './Endpoint';

export const ALL_ENDPOINTS: Endpoint[] = [new EchoEndpoint(), new AddUserEndpoint(), new CreateWalletEndpoint()];
export const ALL_ENDPOINT_NAMES = ALL_ENDPOINTS.map((e) => e.name);

export * from './endpointNames';

export { EchoEndpoint, AddUserEndpoint, CreateWalletEndpoint };
