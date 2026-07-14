import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { BASE_DB_PATH } from "./constants";

export default defineConfig({
  dialect: "sqlite",
  schema: "../../packages/db/src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: path.join(BASE_DB_PATH, "vaze.db"),
  },
});
