# Vaze | Local File Storage & Hosting

<div align="center">

<img src="./.github/images/vaze.png" alt="logo" width="200"/>

[![Docker Pulls](https://img.shields.io/docker/pulls/darseen/vaze?style=for-the-badge)](https://hub.docker.com/r/darseen/vaze)
![Docker Image Version (tag)](https://img.shields.io/docker/v/darseen/vaze/latest?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
<br/>
<br/>
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/vaze?referralCode=InkF11&utm_medium=integration&utm_source=template&utm_campaign=generic)

**Vaze** is a self-hosted, local-first file storage and hosting service built with Next.js. Run it easily as a Docker container on your own server or home network. It provides a clean web interface for managing your files and a powerful API to use as a backend for your other applications.

## </div>

## Features

- **File & Folder Management**: Create, rename, and delete files and folders directly from the web UI.
- **Path-addressed storage**: Files keep the name you upload them with, so you choose the public URL — `https://your-vaze/api/hosting/projects/demo/photo.png`.
- **Streaming uploads**: Upload bodies go straight to disk, so file size is bounded by your volume rather than by memory.
- **Download & Public Hosting**: Download files directly, or embed them from a public hosting URL that serves untrusted content sandboxed.
- **API Key Management**: Generate and manage API keys from a dedicated dashboard to securely interact with your storage from other apps.
- **Powerful API**: Use Vaze as a backend service for any application that needs file hosting or storage, with simple RESTful endpoints.
- **Dockerized**: Get up and running in minutes with the official Docker image.

### Roadmap

Not built yet: moving files between folders, folder upload and drag-and-drop,
zip download of a folder, presigned URLs, private files, range requests, and
API-key scopes.

---

## Getting Started

All you need is [Docker](https://docs.docker.com/get-docker/) with the Compose plugin.

### Quick Install

One command sets up everything — it checks Docker, downloads `compose.prod.yaml`,
generates your `AUTH_SECRET` into a `.env`, and starts the container:

```bash
curl -fsSL https://raw.githubusercontent.com/darseen/vaze/main/scripts/install.sh | sh
```

The only thing it asks for is the URL you'll open Vaze on, and it defaults to this
machine's LAN address. Pass it in to skip the prompt entirely:

```bash
curl -fsSL https://raw.githubusercontent.com/darseen/vaze/main/scripts/install.sh \
  | BASE_URL=https://files.example.com sh
```

**Re-run it from the same directory to upgrade**: it refreshes the compose file,
pulls the newer image, and recreates the container — while never overwriting a
value already in your `.env` and never touching the volume your uploads and
database live in. Skip to [Initial setup](#initial-setup-admin-registration) once
it finishes.

Options: `--dir=PATH` to choose the install directory (default `./vaze`), and
`--no-start` to write the config without starting. `BASE_URL`, `VAZE_PORT`,
`VAZE_VERSION`, `VAZE_BIND_ADDR` and `TZ` can all be set in the environment or
edited in `.env` afterwards.

Prefer to read a script before piping it to a shell? Download it first, or follow
the manual steps below.

### Manual install with Docker Compose

Grab [`compose.prod.yaml`](./compose.prod.yaml), put a `.env` next to it:

```ini
AUTH_SECRET=generate-with-openssl-rand-base64-32
BASE_URL=http://your-server-ip-or-domain:3000
VAZE_PORT=3000
VAZE_VERSION=latest
```

then start it:

```bash
docker compose -f compose.prod.yaml up -d
```

### Manual install with `docker run`

```bash
docker run -d \
  -p 3000:3000 \
  -v vaze_data:/app/data \
  -e BASE_URL="http://your-server-ip-or-domain:3000" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  --restart unless-stopped \
  --name vaze \
  darseen/vaze:latest
```

- `-p 3000:3000` maps port 3000 on your host to the container's port 3000.
- `-v vaze_data:/app/data` persists uploads and the SQLite database outside the
  container, so they survive updates and removals.

### Initial setup (admin registration)

1. Open `http://<your-server-ip>:3000` in your browser.
2. You will be prompted to register — **the first user to register becomes the admin**.
3. Log in with your new credentials.

That's it! You can now start uploading and managing your files.

## Managing your instance

Run these from your install directory (`./vaze` by default):

```bash
docker compose -f compose.prod.yaml logs -f   # follow logs
docker compose -f compose.prod.yaml ps        # status and health
docker compose -f compose.prod.yaml restart   # restart
docker compose -f compose.prod.yaml down      # stop (keeps your data)
```

To upgrade, re-run the installer from that directory — or do it by hand:

```bash
docker compose -f compose.prod.yaml pull && docker compose -f compose.prod.yaml up -d
```

> [!WARNING]
> `docker compose -f compose.prod.yaml down -v` also deletes the `vaze_vaze_data`
> volume — every uploaded file and account goes with it.

## Environment Variables

Everything lives in the `.env` the installer writes next to `compose.prod.yaml`.
Edit it and apply with `docker compose -f compose.prod.yaml up -d`.

| Variable          | Required       | Description                                                                    |
| ----------------- | -------------- | ------------------------------------------------------------------------------ |
| `BASE_URL`        | Yes            | Public base URL of your instance, e.g. `https://files.example.com`. Public file links are built from it. |
| `AUTH_SECRET`     | Yes            | Long random string signing session tokens. Replacing it logs everyone out.       |
| `VAZE_PORT`       | No (`3000`)    | Host port published by the container.                                            |
| `VAZE_BIND_ADDR`  | No (`0.0.0.0`) | Host address to bind to. Set `127.0.0.1` when a reverse proxy fronts Vaze.        |
| `VAZE_VERSION`    | No (`latest`)  | Image tag to run — pin it for reproducible deploys.                              |
| `TZ`              | No (`UTC`)     | Container timezone.                                                              |
| `MAX_UPLOAD_SIZE` | No (`5gb`)     | Largest single file accepted by an upload, e.g. `500mb`.                          |
| `MAX_FILES_PER_REQUEST` | No (`100`) | Cap on files in one multipart request.                                        |
| `API_REQUEST_RETENTION_DAYS` | No (`90`) | How long API request-log rows are kept.                                  |

The installer generates `AUTH_SECRET` for you. To make one by hand:

```bash
openssl rand -base64 32
```

All data lives at `/app/data` inside the container, backed by the `vaze_data`
volume. Keep it on a volume or you will lose every file and account when the
container is removed.

## API Usage

Vaze can be used as a file-hosting backend for your other projects.
You can use Vaze's [official NPM package](https://npmjs.com/package/@darseen/vaze) to interact with the API.

## Screenshots

Here are a few screenshots of the Vaze interface.

<div align="center">
  <h3> Main Dashboard View  </h3>
  <img src="./.github/images/dashboard-1.png" alt="Main Dashboard View 1" width="100%"/>
  <img src="./.github/images/dashboard-2.png" alt="Main Dashboard View 2" width="100%"/>
</div>

<div align="center">
  <h3> File Management Page </h3>
  <img src="./.github/images/files.png" alt="File Management Dashboard" width="100%"/>
</div>

<div align="center">
  <h3> API Keys Management Page </h3>
  <img src="./.github/images/api-keys.png" alt="API Keys Management Interface" width="100%"/>
</div>

<div align="center">
  <h3> Registration Page </h3>
  <img src="./.github/images/register.png" alt="User Registration Page" width="100%"/>
</div>

## Contributing

Contributions are welcome! If you'd like to help improve Vaze, please feel free to fork the repository, make changes, and submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
