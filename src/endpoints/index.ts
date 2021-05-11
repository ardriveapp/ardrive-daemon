import { EchoEndpoint } from './echo';
import { AddUserEndpoint, AuthenticateUserEndpoint } from './user';
import { CreateWalletEndpoint } from './wallet';
import { Endpoint } from './Endpoint';
import { GetUnsyncedDrivesEndpoint } from './drive';

export const ALL_ENDPOINTS: Endpoint[] = [
	// Testing
	new EchoEndpoint(),
	// User
	new AddUserEndpoint(),
	new AuthenticateUserEndpoint(),
	// Wallet
	new CreateWalletEndpoint(),
	// Drive
	new GetUnsyncedDrivesEndpoint()
];
export const ALL_ENDPOINT_NAMES = ALL_ENDPOINTS.map((e) => e.name);

export * from './endpointNames';

export { EchoEndpoint, AddUserEndpoint, AuthenticateUserEndpoint, CreateWalletEndpoint, GetUnsyncedDrivesEndpoint };
