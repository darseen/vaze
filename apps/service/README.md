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
- PDF tools: merge, split, rearrange, turn and number pages, and make PDFs
  from images or from documents, spreadsheets and presentations.
- Dashboard analytics: storage usage, largest files, file types and API usage.

## Getting started

From the repository root:

```bash
pnpm install
pnpm --filter service dev
```

Then open [http://localhost:3000](http://localhost:3000). On first launch you'll
be redirected to `/register` to create the admin account.

Video conversion and video to audio run `ffmpeg` and `ffprobe`, so install
ffmpeg locally (e.g. `brew install ffmpeg`, `apt install ffmpeg`). Videos are
encoded with x264, x265, libvpx, SVT-AV1 and Opus, and HDR is tone mapped with
zimg, which most ffmpeg builds include; a codec your build lacks fails with a
message naming it. The Docker image already includes all of them. A video
converts as a job, one at a time with eight more waiting, and its result stays
in `${DATA_PATH}/tmp` for an hour after it finishes.

Image conversion uses `sharp`, which needs nothing else, except for HEIC
images: those are decoded by `heif-dec` from libheif 1.17 or later (e.g.
`brew install libheif`, or `libheif-examples` on Debian and Ubuntu). The
Docker image already includes it.

The PDF tools use `pdf-lib`, on a worker thread so a large PDF doesn't hold up
other requests. Turning DOCX, XLSX, PPTX, ODT, RTF and similar files into PDFs
needs LibreOffice's `soffice` (e.g. `brew install --cask libreoffice`,
`apt install libreoffice-writer libreoffice-calc libreoffice-impress`), and is
off unless `ENABLE_DOCUMENT_CONVERSION=true`. LibreOffice runs with macros, OLE
and links switched off, so a document can't run code or pull in other files.

The Docker image leaves LibreOffice out, as it adds about 1 GB. With
`ENABLE_DOCUMENT_CONVERSION=true`, the container installs it with the Liberation
and Noto fonts as it starts, which takes a few minutes and happens again
whenever the container is recreated, e.g. on an upgrade. Installing needs the
container to start as root, as it does by default; Vaze itself then runs as
`node`.

## Environment variables

| Variable                     | Required    | Description                                                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                | Yes (prod)  | Secret used to sign session JWTs. The app refuses to sign/verify tokens if it is unset.           |
| `BASE_URL`                   | Recommended | Public base URL. Used to decide whether the auth cookie is marked `secure` (`https://...`).       |
| `DATA_PATH`                  | No          | Absolute path for the SQLite DB and uploads. Defaults to `<cwd>/data`.                            |
| `FFMPEG_PATH`                | No          | Path to the `ffmpeg` binary. Defaults to `ffmpeg` on `PATH`.                                      |
| `FFPROBE_PATH`               | No          | Path to the `ffprobe` binary. Defaults to `ffprobe` on `PATH`.                                    |
| `HEIF_DEC_PATH`              | No          | Path to libheif's `heif-dec` binary. Defaults to `heif-dec` on `PATH`.                            |
| `SOFFICE_PATH`               | No          | Path to LibreOffice's `soffice` binary. Defaults to `soffice` on `PATH`.                          |
| `ENABLE_DOCUMENT_CONVERSION` | No          | `true` turns documents into PDFs, and in Docker installs LibreOffice on start, adding about 1 GB. |

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
