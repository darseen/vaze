import path from "node:path";

export const BASE_DATA_PATH = path.join(process.cwd(), "data");
export const BASE_DB_PATH = path.join(BASE_DATA_PATH, "db");
export const BASE_UPLOADS_PATH = path.join(BASE_DATA_PATH, "uploads");
