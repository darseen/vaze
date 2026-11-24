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

**Vaze** is a self-hosted file storage and hosting service that runs as a single Docker container on your own server or home network. Manage your files from the web dashboard or the Android app, host them at URLs you choose, convert videos and images without them leaving your server, and use its API as a file backend for your other apps. Installation, configuration, the API reference and the SDK guide are all in the **[documentation](https://vaze.darseen.dev/docs)**, starting with **[installation](https://vaze.darseen.dev/docs/getting-started/installation)**.

## Features

- **Files and folders**: Upload whole folders, browse them with thumbnails, search and filter, and open images, video, audio, PDFs and text in a full-screen viewer. Move, download or delete many files at once, and restore mistakes from Recently deleted. Uploads stream straight to disk, so size is limited only by your volume.
- **Hosting at URLs you choose**: Files keep the names you upload them with, so a link like `/api/hosting/projects/demo/photo.jpg` stays the same. Video and audio seek, repeat requests are cached, and images can be resized on the fly.
- **Private files and signed links**: Make any file or folder private, then share it with a link that expires.
- **Video and image conversion**: Compress and convert videos to MP4, WebM, MOV, MKV or GIF, resize, trim or mute them, or keep only their sound as an MP3. Turn HEIC photos and other images into WebP, JPG, PNG or AVIF.
- **Users, roles and API keys**: Add accounts as Admin, Editor or Viewer, or with a custom set of scopes, and give each API key only the access it needs.
- **Dashboard and activity**: See what needs attention, how your storage is used, hosting traffic, the most requested files and how each API key is used, with a history of sign-ins, uploads, deletions and account changes.
- **Android app**: The same files, tools, dashboard, keys and users on your phone, for as many servers as you add.
- **API and SDK**: A REST API and the [`@darseen/vaze`](https://npmjs.com/package/@darseen/vaze) TypeScript SDK for using Vaze from your own apps.
- **Docker**: One container and one data volume, with everything the tools need already inside. A single command installs it and later upgrades it.

## Benchmarks

Vaze and Seafile 14, a long-established self-hosted file server, ran sixteen everyday file operations on the same machine. Vaze was faster in all sixteen, from 1.4× to 33× depending on the operation: it zipped a 500 MiB photo album 16× faster, renamed, moved and deleted files 16× to 33× faster, and served 2,000 public downloads 3.6× faster. It also needed 56 MB of memory after a fresh start, against 489 MB for Seafile with its database and cache. The **[benchmarks page](https://vaze.darseen.dev/benchmarks)** has every result and how it was measured.

## Screenshots

<div align="center">
  <h3> Dashboard </h3>
  <img src="./.github/images/dashboard-1.png" alt="Dashboard with an expiring key alert, storage, hosting traffic and files added over 30 days" width="100%"/>
  <img src="./.github/images/dashboard-2.png" alt="Recent and most requested files, API requests per key and storage by file type" width="100%"/>
</div>

<div align="center">
  <h3> Files </h3>
  <img src="./.github/images/files.jpg" alt="A folder of landscape photos shown as a thumbnail grid" width="100%"/>
</div>

<div align="center">
  <h3> File Viewer </h3>
  <img src="./.github/images/viewer.jpg" alt="A photo open in the full-screen viewer with a filmstrip of the folder" width="100%"/>
</div>

<div align="center">
  <h3> Video Converter </h3>
  <img src="./.github/images/video-converter.png" alt="A 410 MB video converted to a 720p WebM, 98% smaller" width="100%"/>
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
  <img src="./.github/images/mobile.png" alt="The Android app's dashboard, a photo folder, the Tools tab and the video converter" width="100%"/>
</div>

<div align="center">
  <h3> Registration </h3>
  <img src="./.github/images/register.png" alt="Creating the admin account on a new instance" width="100%"/>
</div>

## License

Vaze is released under the [MIT License](./LICENSE). Contributions are welcome: fork the repository and open a pull request.
