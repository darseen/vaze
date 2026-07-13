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
