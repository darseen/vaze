import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // resolves the `@/*` alias from tsconfig.json
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // each file gets its own DATA_PATH, so they must not share a module registry
    isolate: true,
    pool: "forks",
    server: {
      deps: {
        external: ["better-sqlite3"],
      },
    },
  },
});
