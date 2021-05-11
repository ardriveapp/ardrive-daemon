export class ArDriveDaemonError extends Error {
	name = 'ArDriveDaemonError';
}

export class UnknownError extends ArDriveDaemonError {
	name = 'unknown';
}

export class AuthenticationError extends ArDriveDaemonError {
	name = 'AuthenticationError';
	message = 'Authentication failed, check your credentials';
}

export class BadDrive extends ArDriveDaemonError {
	name = 'BadDrive';
	message = "That drives doesn't exists";
}

const ALL_ERRORS: typeof ArDriveDaemonError[] = [ArDriveDaemonError, UnknownError, AuthenticationError];

export function instantiateError(name: string, ...args: []): ArDriveDaemonError {
	const ERROR: typeof ArDriveDaemonError =
		ALL_ERRORS.find((e: typeof ArDriveDaemonError) => {
			return e.name === name;
		}) || UnknownError;
	return new ERROR(...args);
}
