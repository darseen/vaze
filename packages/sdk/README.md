# Vaze SDK

<div align="center">

<img src="../../.github/images/vaze.png" alt="logo" width="200"/>

![NPM Downloads](https://img.shields.io/npm/dm/@darseen/vaze?style=for-the-badge)
![NPM Version](https://img.shields.io/npm/v/@darseen/vaze?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**@darseen/vaze** The official JavaScript/TypeScript SDK for Vaze, a self-hosted, local-first file storage and hosting service. This SDK provides a simple and type-safe way to interact with your Vaze instance's API from your Node.js backend or frontend applications.

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

# Using Environment Variables

If you set `VAZE_URL` and `VAZE_API_KEY` in your environment, you can initialize the client without passing arguments:

```ts
import Vaze from "@darseen/vaze";

// Automatically picks up process.env.VAZE_URL and process.env.VAZE_API_KEY
const vaze = new Vaze();
```

# API Documentation

The SDK is divided into two main modules: `files` and `folders`. All methods are asynchronous and return a standard `ApiResponse` object containing either `data` or an `error`. Files API Access file-related methods via `vaze.files.getAll(options?)` Retrieve a paginated list of all files.

- options (optional):
  - `limit`
  - `offset`
  - `orderBy`
  - `orderDirection`

```ts
const { data, error } = await vaze.files.getAll({
  limit: 10,
  orderBy: "created_at",
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

`getByName(name, options?)` Search for files by name.

```ts
const { data, error } = await vaze.files.getByName("document.pdf", {
  limit: 5,
});
```

`upload(data)` Upload one or multiple files to your Vaze instance.

- data:
  - `files` (File[]): An array of standard `File` objects.
  - `folder?` (string): The ID or name of the target folder.

```ts
const { data, error } = await vaze.files.upload({
  files,
  folder: "optional-folder-name", // example: "documents" or "projects/work" (supports sub-folders)
});
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
  - `path` example: "projects/work"
  - `limit`
  - `offset`
  - `orderBy`
  - `orderDirection`

```ts
const { data, error } = await vaze.folders.get({
  path: "/documents/work",
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

`delete(id)` Delete a folder by its ID.

```ts
const { data, error } = await vaze.folders.delete("folder-id");
```

# Types

This SDK is built with TypeScript and exports all necessary types to ensure type safety in your applications. Types such as `FileWithUrl`, `Folder`, and `ApiResponse`.
