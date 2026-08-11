import type { Visibility } from "@repo/types";
import path from "node:path";

// Where the SQLite DB and uploaded files live. Defaults to `<cwd>/data`, but in
// production this is pinned via the DATA_PATH env var so it does not depend on
// the process working directory (Next's standalone server chdir's to its own
// bundle dir) and always resolves to the mounted Docker volume.
export const BASE_DATA_PATH = process.env.DATA_PATH
  ? path.resolve(process.env.DATA_PATH)
  : path.join(process.cwd(), "data");
export const BASE_DB_PATH = path.join(BASE_DATA_PATH, "db");
export const BASE_UPLOADS_PATH = path.join(BASE_DATA_PATH, "uploads");
// Uploads are staged here and moved into place only once fully received. Same
// filesystem as uploads, so the move is an atomic rename.
export const BASE_TMP_PATH = path.join(BASE_DATA_PATH, "tmp");

const BYTE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

function parseBytes(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?\s*$/i.exec(value);
  if (!match) return fallback;

  const size = Number.parseFloat(match[1]);
  const unit = BYTE_UNITS[(match[2] ?? "b").toLowerCase()];
  if (!Number.isFinite(size) || !unit) return fallback;

  return Math.floor(size * unit);
}

function parseCount(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Largest single file accepted by an upload. Accepts e.g. `500mb`, `5gb`. */
export const MAX_UPLOAD_SIZE = parseBytes(
  process.env.MAX_UPLOAD_SIZE,
  5 * 1024 ** 3,
);

/** Cap on parts in one multipart request, so a single body can't fan out. */
export const MAX_FILES_PER_REQUEST = parseCount(
  process.env.MAX_FILES_PER_REQUEST,
  100,
);

/** Cap on ids accepted by one batch delete request. */
export const MAX_DELETE_BATCH = parseCount(process.env.MAX_DELETE_BATCH, 500);

/** How long request-log rows are kept before being pruned. */
export const API_REQUEST_RETENTION_DAYS = parseCount(
  process.env.API_REQUEST_RETENTION_DAYS,
  90,
);

/**
 * `max-age` for publicly hosted responses. Zero means revalidate every time,
 * which is cheap because a match answers with a bodiless 304. Raise it when the
 * keys on an instance are effectively immutable.
 */
export const HOSTING_CACHE_MAX_AGE = parseCount(
  process.env.HOSTING_CACHE_MAX_AGE,
  0,
);

/** Visibility applied to an upload that does not ask for one. */
export const DEFAULT_FILE_VISIBILITY: Visibility =
  process.env.DEFAULT_FILE_VISIBILITY === "private" ? "private" : "public";

/** Lifetime of a signed URL when the caller does not specify one. */
export const DEFAULT_PRESIGN_TTL_SECONDS = parseCount(
  process.env.DEFAULT_PRESIGN_TTL_SECONDS,
  3600,
);

/** Longest lifetime a signed URL may be minted with. Matches S3's cap. */
export const MAX_PRESIGN_TTL_SECONDS = parseCount(
  process.env.MAX_PRESIGN_TTL_SECONDS,
  7 * 24 * 60 * 60,
);
