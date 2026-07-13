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
- Public file hosting via `/api/hosting/<filename>`.
- Dashboard analytics: storage usage, largest files, file types and API usage.

## Getting started

From the repository root:

```bash
pnpm install
pnpm --filter service dev
```

Then open [http://localhost:3000](http://localhost:3000). On first launch you'll
be redirected to `/register` to create the admin account.

## Environment variables

| Variable      | Required        | Description                                                                                 |
| ------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `AUTH_SECRET` | Yes (prod)      | Secret used to sign session JWTs. The app refuses to sign/verify tokens if it is unset.     |
| `BASE_URL`    | Recommended     | Public base URL. Used to decide whether the auth cookie is marked `secure` (`https://...`). |
| `DATA_PATH`   | No              | Absolute path for the SQLite DB and uploads. Defaults to `<cwd>/data`.                       |

## Data & persistence

The SQLite database lives in `${DATA_PATH}/db/vaze.db` and uploaded files in
`${DATA_PATH}/uploads`. In Docker, `DATA_PATH` is pinned to `/app/data`, which is
where the named `storage` volume is mounted (see [`compose.yaml`](../../compose.yaml)) —
so data survives container recreation.

## Docker

```bash
docker compose up --build
```

Provide `AUTH_SECRET` (and ideally `BASE_URL`) via the environment. If
`AUTH_SECRET` is not supplied, the container entrypoint generates a temporary
one per instance — fine for a quick trial, but sessions will not survive a
restart.
