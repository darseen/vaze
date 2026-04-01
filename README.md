# Vaze | Local File Storage & Hosting

<div align="center">

<img src="./.github/images/vaze.png" alt="logo" width="200"/>

[![Docker Pulls](https://img.shields.io/docker/pulls/darseen/vaze?style=for-the-badge)](https://hub.docker.com/r/darseen/vaze)
![Docker Image Version (tag)](https://img.shields.io/docker/v/darseen/vaze/latest?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Vaze** is a self-hosted, local-first file storage and hosting service built with Next.js. Run it easily as a Docker container on your own server or home network. It provides a clean web interface for managing your files and a powerful API to use as a backend for your other applications.

## </div>

## Features

- **Full File & Folder Management**: Create, rename, move, and delete files and folders directly from the web UI.
- **Simple Uploads**: Easily upload files and folders through a drag-and-drop interface.
- **Export & Download**: Download individual files or entire folders as a zip archive.
- **API Key Management**: Generate and manage API keys from a dedicated dashboard to securely interact with your storage from other apps.
- **Powerful API**: Use Vaze as a backend service for any application that needs file hosting or storage, with simple RESTful endpoints.
- **Dockerized**: Get up and running in minutes with the official Docker image.

---

## Getting Started

Getting your own Vaze instance running is simple. All you need is Docker installed on your system.

### 1. Pull the Docker Image

Pull the latest image from Docker Hub.

```bash
docker pull darseen/vaze:latest
```

## 2. Run the Container

Run the Docker container, mapping your volume, port, and setting your `BASE_URL` and `AUTH_SECRET`:

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/on/your/machine:/app/apps/service/data \
  -e BASE_URL="http://your-server-ip-or-domain:3000" \
  -e AUTH_SECRET="your-secret-key" \
  --name vaze \
  darseen/vaze:latest
```

- `-p 3000:3000`: Maps port 3000 on your host to the container's port 3000.
- `-v /path/on/your/host/machine:/app/data`: This mounts a directory from your host machine into the container. It ensures your uploaded files are saved on your machine and persist even if the container is removed or updated.

## 3. Initial Setup (Admin Registration)

Once the container is running, you need to create your first (admin) user.

1. Navigate to your server's IP address on port 3000 in your web browser: `http://<your-server-ip>:3000`
2. You will be prompted to register. The first user to register automatically becomes the admin user.
3. Log in with your newly created credentials.

That's it! You can now start uploading and managing your files.

## Environment Variables

The following environment variables should be set. If not set, the default values will be used.

- `BASE_URL`: The base URL of your Vaze instance.
- `AUTH_SECRET`: A secret key used to sign JWT tokens.

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
