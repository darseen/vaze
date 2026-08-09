import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "data/**"]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // test scaffolding pokes at loosely-typed JSON payloads
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
