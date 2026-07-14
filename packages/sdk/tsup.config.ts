import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  // Resolve and inline external .d.ts (from @repo/types → @repo/db) so the
  // published declaration file is self-contained: consumers need none of the
  // workspace packages the SDK is built from.
  dts: { resolve: true },
  splitting: true,
  clean: true,
  noExternal: ["@repo/types", "@repo/db", "drizzle-orm"],
});
