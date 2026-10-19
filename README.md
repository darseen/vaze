# Vaze | Local File Storage & Hosting

<div align="center">

<img src="./.github/images/vaze.png" alt="logo" width="200"/>

[![GitHub Container Registry](https://img.shields.io/badge/ghcr.io-darseen%2Fvaze-blue?style=for-the-badge&logo=docker)](https://github.com/darseen/vaze/pkgs/container/vaze)
![Latest Version](https://img.shields.io/github/v/tag/darseen/vaze?style=for-the-badge&label=version)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
<br/>
<br/>
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/vaze?referralCode=InkF11&utm_medium=integration&utm_source=template&utm_campaign=generic)

**[Website](https://vaze.darseen.dev)** &nbsp;|&nbsp; **[Documentation](https://vaze.darseen.dev/docs)**

</div>

**Vaze** is a self-hosted file storage and hosting service that runs as a single Docker container on your own server or home network. Manage your files from the web dashboard or the Android app, host them at URLs you choose, and use its API as a file backend for your other apps. Installation, configuration, the API reference and the SDK guide are all in the **[documentation](https://vaze.darseen.dev/docs)**, starting with **[installation](https://vaze.darseen.dev/docs/getting-started/installation)**.

## Features

- **Files and folders**: Upload whole folders, browse with thumbnails and a viewer, and download, move or delete many files at once. Uploads stream straight to disk, so size is limited only by your volume.
- **Hosting at URLs you choose**: Files keep the names you upload them with, so a link like `/api/hosting/projects/demo/photo.png` stays the same. Audio and video seek properly, and repeat requests are cached.
- **Private files and signed links**: Make any file or folder private, then share it with a link that expires.
- **Users, roles and API keys**: Add accounts as Admin, Editor or Viewer, or with a custom set of scopes, and give each API key only the access it needs.
- **Dashboard**: See what needs attention, how your storage is used, hosting traffic, the most requested files and how each API key is used.
- **Android app**: The same files, dashboard, keys and users on your phone, for as many servers as you add.
- **API and SDK**: A REST API and the [`@darseen/vaze`](https://npmjs.com/package/@darseen/vaze) TypeScript SDK for using Vaze from your own apps.
- **Docker**: One container and one data volume. A single command installs it and later upgrades it.

## Screenshots

<div align="center">
  <h3> Dashboard </h3>
  <img src="./.github/images/dashboard-1.png" alt="Dashboard with an expiring key alert, storage, hosting traffic and files added over 30 days" width="100%"/>
  <img src="./.github/images/dashboard-2.png" alt="Recent files, most requested hosted files, API requests per day and storage by file type" width="100%"/>
</div>

<div align="center">
  <h3> Files </h3>
  <img src="./.github/images/files.jpg" alt="A folder of photos shown as a thumbnail grid" width="100%"/>
</div>

<div align="center">
  <h3> File Viewer </h3>
  <img src="./.github/images/viewer.jpg" alt="A photo open in the full-screen viewer with a filmstrip of the folder" width="100%"/>
</div>

<div align="center">
  <h3> API Keys </h3>
  <img src="./.github/images/api-keys.png" alt="API keys with their scopes, last use and expiry" width="100%"/>
</div>

<div align="center">
  <h3> Users </h3>
  <img src="./.github/images/users.png" alt="Accounts with roles, custom scopes and a disabled user" width="100%"/>
</div>

<div align="center">
  <h3> Activity </h3>
  <img src="./.github/images/activity.png" alt="Activity history grouped by day" width="100%"/>
</div>

<div align="center">
  <h3> Android App </h3>
  <img src="./.github/images/mobile.png" alt="The Android app's dashboard, a photo folder, hosting traffic and activity" width="100%"/>
</div>

<div align="center">
  <h3> Registration </h3>
  <img src="./.github/images/register.png" alt="Creating the admin account on a new instance" width="100%"/>
</div>

## License

Vaze is released under the [MIT License](./LICENSE). Contributions are welcome: fork the repository and open a pull request.
