# ArDrive Daemon


ArDrive Daemon is a cross-platform wrapper of the ArDrive Core-JS and is used for synchronizing data to and from Arweave.

[![Gitopia](https://img.shields.io/endpoint?style=&url=https://gitopia.org/mirror-badge.json)](gitopia-repo)

## Installation

We use Yarn 2.x please follow [the guidelines](https://yarnpkg.com/getting-started/install)

### VSCode/VSCodium integration:

- Make sure to open ardrive-core.code-workspace
- Install recomended extensions (
  - arcanis.vscode-zipfs,
  - dbaeumer.vscode-eslint,
  - esbenp.prettier-vscode )

On repo main folder run:
```console
$ yarn
```

# Build

All compiled source files are in `lib/` with the same folder structure than `src/`.
For building the project, you would run
```console
$ yarn build
```

That will compile both: the daemon service and the client

# Runninging the Daemon

A service will start in daemon mode by doing

 ```console
$ yarn start
 ```

or

```console
$ yarn start-dev
```

to run the service in the current console and watch the file for changes.

# The client API

You access the daemon API by using the `ClientService` export of *ardrive-daemon*.

```ts
import { ClientService } from 'ardrive-daemon';
```

## Setup a client connection

`ClientService` is a singleton. It means any time you instantiate a new client that's the same instance within the module scope.

```ts
const service = new ClientService();
```

Before making any request to the already running Daemon, the client has to connect:

```ts
await service.clientConnect();
```

That function will throw an error if the connection fails.

## Trigger endpoint actions

All endpoints are accessible by the `run` method.

```ts
const result = await service.run(endpointName: string, ...args: any);
```

`endpointName` must be the `name` property of a valid `Endpoint`, and the rest of the args are the ones that the endpoint handler function requests.

## Action response

The response of an action will either be the returned value of the Endpoint. In the case of an error, the promise of the fired transaction will throw an error.

## Authentication

The authentication is managed by the `AuthenticationMiddleware`. It checks if the user has already authenticated in a specific session when an Endpoint specifies it requires authentication. An error will be thrown whenever the Daemon assumes you need to re-authenticate (for now, only once per session).

The error thrown when the user is unauthenticated is `AuthenticationError`. It happens when the user is trying to acces a private endpoint and it hasn't authenticated yet. Or, if the provided credentials are wrong.

## Gracefully close the connection

After you have done all your stuff with the daemon connection, you can close de connection by doing:

```ts
service.disconnect();
```
