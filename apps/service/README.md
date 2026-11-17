# Vaze — Service

The Vaze service is a self-hostable, single-admin file storage and hosting
server built with [Next.js](https://nextjs.org). It provides a dashboard for
managing files, folders and API keys, plus a JSON API (consumed by
[`@repo/sdk`](../../packages/sdk)) for programmatic uploads, downloads and
public file hosting.

## Features

- Single administrator account (created on first run via `/register`).
- File & folder management with nested folders.
- API keys (with optional expiry) for programmatic access.
- Public file hosting via `/api/hosting/<filename>`, with images resized and
  converted on request (`?w=800&format=webp`) from a fixed set of widths.
- Dashboard analytics: storage usage, largest files, file types and API usage.

## Getting started

From the repository root:

```bash
pnpm install
pnpm --filter service dev
```

Then open [http://localhost:3000](http://localhost:3000). On first launch you'll
be redirected to `/register` to create the admin account.

Video to audio conversion runs `ffmpeg` and `ffprobe`, so install ffmpeg
locally (e.g. `brew install ffmpeg`, `apt install ffmpeg`). The Docker image
already includes it.

Image conversion uses `sharp`, which needs nothing else, except for HEIC
images: those are decoded by `heif-dec` from libheif 1.17 or later (e.g.
`brew install libheif`, or `libheif-examples` on Debian and Ubuntu). The
Docker image already includes it.

## Environment variables

| Variable        | Required    | Description                                                                                 |
| --------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`   | Yes (prod)  | Secret used to sign session JWTs. The app refuses to sign/verify tokens if it is unset.     |
| `BASE_URL`      | Recommended | Public base URL. Used to decide whether the auth cookie is marked `secure` (`https://...`). |
| `DATA_PATH`     | No          | Absolute path for the SQLite DB and uploads. Defaults to `<cwd>/data`.                      |
| `FFMPEG_PATH`   | No          | Path to the `ffmpeg` binary. Defaults to `ffmpeg` on `PATH`.                                |
| `FFPROBE_PATH`  | No          | Path to the `ffprobe` binary. Defaults to `ffprobe` on `PATH`.                              |
| `HEIF_DEC_PATH` | No          | Path to libheif's `heif-dec` binary. Defaults to `heif-dec` on `PATH`.                      |

## Data & persistence

The SQLite database lives in `${DATA_PATH}/db/vaze.db` and uploaded files in
`${DATA_PATH}/uploads`. Thumbnails and the resized copies hosting URLs ask for
are kept in `${DATA_PATH}/thumbnails` and `${DATA_PATH}/hosted-images` until
their file is deleted for good. In Docker, `DATA_PATH` is pinned to `/var/lib/vaze`, which
is where the named `vaze_data` volume is mounted (see
[`compose.prod.yaml`](../../compose.prod.yaml)), so data survives container
recreation. The entrypoint refuses to start when `DATA_PATH` is not on a mounted
volume unless `ALLOW_EPHEMERAL_DATA=true`.

## Docker

To build the image from this checkout:

```bash
docker build -f apps/service/Dockerfile -t vaze:dev .   # from the repo root
```

Provide `AUTH_SECRET` (and ideally `BASE_URL`) via the environment. If
`AUTH_SECRET` is not supplied, the container entrypoint generates a temporary
one per instance — fine for a quick trial, but sessions will not survive a
restart.

To run the published image, use [`compose.prod.yaml`](../../compose.prod.yaml)
or the one-line installer in the [root README](../../README.md).
