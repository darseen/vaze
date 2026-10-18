# Vaze SDK

<div align="center">

<img src="../../.github/images/vaze.png" alt="logo" width="200"/>

![NPM Downloads](https://img.shields.io/npm/dm/@darseen/vaze?style=for-the-badge)
![NPM Version](https://img.shields.io/npm/v/@darseen/vaze?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**@darseen/vaze** The official JavaScript/TypeScript SDK for Vaze, a self-hosted, local-first file storage and hosting service. This SDK provides a simple and type-safe way to interact with your Vaze instance's API from your Node.js backend or frontend applications.

**[Website](https://vaze.darseen.dev)** &nbsp;|&nbsp; **[SDK documentation](https://vaze.darseen.dev/docs/sdk)**

## </div>

# Installation

Install the package using your preferred package manager:

```
npm install @darseen/vaze
# or
yarn add @darseen/vaze
# or
pnpm add @darseen/vaze
```

# Initialization

To use the SDK, you must instantiate the `Vaze` client. You can provide your configuration either directly through the constructor options or via environment variables. Using Constructor Options

```ts
import Vaze from "@darseen/vaze";

const vaze = new Vaze({
  vazeUrl: "http://your-server-ip:3000",
  apiKey: "YOUR_API_KEY",
});
```

# Acting as a Signed-in User

Apps that sign people in can send their session instead of an API key. Pass `headers`, an object or a function called before every request, and an optional `fetch` to replace the global one:

```ts
const vaze = new Vaze({
  vazeUrl: "http://your-server-ip:3000",
  headers: async () => ({ cookie: await getSessionCookie() }),
  fetch: (input, init) => fetch(input, { ...init, credentials: "omit" }),
});
```

`vaze.authHeaders()` returns the headers the SDK sends, for clients that fetch an SDK URL themselves, such as `vaze.files.thumbnailUrl(id)` or `vaze.files.downloadUrl(id)`.

# Using Environment Variables

If you set `VAZE_URL` and `VAZE_API_KEY` in your environment, you can initialize the client without passing arguments:

```ts
import Vaze from "@darseen/vaze";

// Automatically picks up process.env.VAZE_URL and process.env.VAZE_API_KEY
const vaze = new Vaze();
```

# API Documentation

The SDK's main modules are `files` and `folders`, plus `keys`, `account`, `activity`, `users` and `settings` for signed-in users. All methods are asynchronous and return a standard `ApiResponse` object containing either `data` or an `error`. Files API Access file-related methods via `vaze.files.getAll(options?)` Retrieve a paginated list of all files.

- options (optional):
  - `limit`
  - `offset`
  - `orderBy`
  - `orderDirection`

```ts
const { data, error } = await vaze.files.getAll({
  limit: 10,
  orderBy: "createdAt",
  orderDirection: "DESC",
});

if (data) {
  console.log(data.files);
}
```

`getById(id)` Retrieve a specific file by its ID.

```ts
const { data, error } = await vaze.files.getById("file-id");
```

`getByName(name, options?)` Search for files by name. Returns an empty `files` array when nothing matches.

```ts
const { data, error } = await vaze.files.getByName("document.pdf", {
  limit: 5,
});
```

`upload(data)` Upload one or multiple files to your Vaze instance.

- data:
  - `files` (File[]): An array of standard web [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) objects, or in React Native, `{ uri, name, type }` references.
  - `folder?` (string): The path of the target folder, created if it doesn't exist.

```ts
const { data, error } = await vaze.files.upload({
  files,
  folder: "optional-folder-name", // example: "documents" or "projects/work" (supports sub-folders)
});
```

`download(id)` Download a file's contents by its ID.

```ts
const { data, error } = await vaze.files.download("file-id-123");

if (data) {
  console.log(data.filename); // original file name
  console.log(data.contentType); // e.g. "image/png"
  const buffer = Buffer.from(await data.blob.arrayBuffer());
}
```

`downloadMany(ids)` Download several files as one zip. Entries keep their paths below the folder the files share.

```ts
const { data, error } = await vaze.files.downloadMany(["file-id-123", "file-id-456"]);

if (data) {
  console.log(data.filename); // e.g. "photos.zip"
  const buffer = Buffer.from(await data.blob.arrayBuffer());
}
```

`rename(data)` Rename an existing file.

- data:
  - `id` (string): The ID of the file to rename.
  - `name` (string): The new name for the file.

```ts
const { data, error } = await vaze.files.rename({
  id: "file-id-123",
  name: "new-document-name.pdf",
});
```

`delete(id)` Delete a file by its ID.

```ts
const { data, error } = await vaze.files.delete("file-id-123");
```

Folders API Access folder-related methods via `vaze.folders`. `get(options?)` Retrieve folders and their contents.

- options (optional):
  - `id`
  - `key` example: "projects/work"
  - `limit`
  - `offset`
  - `orderBy`
  - `orderDirection`

```ts
const { data, error } = await vaze.folders.get({
  key: "documents/work",
  limit: 20,
});

if (data) {
  console.log("Files:", data.files);
  console.log("Sub-folders:", data.folders);
}
```

`create(folder)` Create a new folder.

- folder: The name or path of the new folder. Example: "projects" or "projects/work"

```ts
const { data, error } = await vaze.folders.create("projects/work");
```

`rename(data)` Rename an existing folder.

- data:
  - `id`: The ID of the folder to rename.
  - `name`: The new name.

```ts
const { data, error } = await vaze.folders.rename({
  id: "folder-id-456",
  name: "new-name",
});
```

`download(options?)` Download a folder and everything below it as one zip. With no `id` or `key`, the root folder is archived.

```ts
const { data, error } = await vaze.folders.download({ key: "projects/work" });

if (data) {
  console.log(data.filename); // "work.zip", with every entry under work/
  const buffer = Buffer.from(await data.blob.arrayBuffer());
}
```

`delete(id)` Delete a folder by its ID.

```ts
const { data, error } = await vaze.folders.delete("folder-id");
```

Keys API Manage the caller's API keys via `vaze.keys`. These calls need a client that acts as a signed-in user (`headers`) holding `api-keys:manage`; a client built with an API key gets a `403`.

`getAll()` List the caller's keys, newest first.

```ts
const { data, error } = await vaze.keys.getAll();
```

`create(options)` Create a key. The secret in `data.key.key` is only returned this once.

- options:
  - `name`: Unique among the caller's keys.
  - `scopes`: Any of `files:read`, `files:write` and `files:delete` the caller holds.
  - `expiresAt` (optional): A `Date` or ISO string; leave it out for a key that never expires.

```ts
const { data, error } = await vaze.keys.create({
  name: "Backup script",
  scopes: ["files:read", "files:write"],
});

console.log(data?.key.key); // "vz_..."
```

`rename(data)` Rename a key. Scopes and expiry can't change.

```ts
const { data, error } = await vaze.keys.rename({ id: "key-id", name: "Nightly backup" });
```

`delete(id)` Delete a key, which stops working right away.

```ts
const { data, error } = await vaze.keys.delete("key-id");
```

Account API Change the signed-in user's own account via `vaze.account`. These calls need a client that acts as a signed-in user (`headers`); a client built with an API key gets a `403`.

```ts
await vaze.account.update({ name: "Dana Scully", email: "dana@example.org" });
await vaze.account.changePassword({ currentPassword: "old", newPassword: "new-password", revokeOtherSessions: true });

const { data } = await vaze.account.getSessions(); // devices, the current one first
await vaze.account.revokeSession("session-id");
await vaze.account.revokeOtherSessions();
```

Activity API Read and prune the caller's history of uploads, deletions and changes via `vaze.activity`. Needs a signed-in user.

```ts
const { data } = await vaze.activity.getAll(); // the 200 most recent entries
await vaze.activity.delete(["activity-id"]);
await vaze.activity.clear();
```

Users API Manage accounts via `vaze.users`. Needs a signed-in admin (`users:manage`). None of the changes work on the caller's own account.

```ts
const { data } = await vaze.users.getAll();
await vaze.users.create({ name: "Dana", email: "dana@example.com", password: "a-long-password", role: "viewer" });
await vaze.users.setAccess({ id: "user-id", role: "custom", scopes: ["files:read"] });
await vaze.users.resetPassword({ id: "user-id", password: "a-new-password" });
await vaze.users.setDisabled({ id: "user-id", disabled: true });
await vaze.users.delete("user-id");
```

Settings API Read and change instance-wide settings via `vaze.settings`. Needs a signed-in user holding `settings:manage`.

```ts
const { data } = await vaze.settings.get(); // defaultVisibility, visibilityCounts, limits
await vaze.settings.update({ defaultVisibility: "private", limits: { activityRetentionDays: 30 } });
await vaze.settings.applyVisibility("private"); // every existing file
```

# Health Check

`vaze.health()` pings the instance to verify connectivity.

```ts
const { data, error } = await vaze.health();

if (data) {
  console.log(data.message); // "Vaze is running!"
}
```

# Account and Stats

`vaze.me()` returns the caller's account and the scopes it may use. `vaze.stats()` returns the dashboard's numbers: storage, files added per day, public hosting traffic, API key usage, accounts and alerts, with each section `null` when the caller lacks its scope. Fields added in later server versions, such as `hosting` and `alerts`, are absent on older servers.

```ts
const { data } = await vaze.me();
const canUpload = data?.scopes.includes("files:write");
```

Failed requests carry the HTTP status in `error.status`, such as `401` once a session expires.

# Types

This SDK is built with TypeScript and exports all necessary types to ensure type safety in your applications. Types such as `File`, `Folder`, `ApiKey`, `Activity`, `User`, `Session`, `InstanceSettings`, `Stats`, `StatsAlert`, `TrafficDay`, `ApiKeyUsage`, `ApiResponse`, `ListOptions`, and `VazeOptions`.
