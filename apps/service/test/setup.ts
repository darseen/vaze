import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// Point the instance at a throwaway directory *before* any module reads
// `DATA_PATH` — `@/constants` resolves it once at import time.
const dataPath = path.join(os.tmpdir(), `vaze-test-${crypto.randomUUID()}`);
fs.mkdirSync(dataPath, { recursive: true });

process.env.DATA_PATH = dataPath;
process.env.AUTH_SECRET ??= "test-secret";
process.env.BASE_URL ??= "http://localhost:3000";
// small enough that an oversize upload is cheap to exercise
process.env.MAX_UPLOAD_SIZE ??= "64kb";

afterAll(() => {
  try {
    fs.rmSync(dataPath, { recursive: true, force: true });
  } catch {
    // Windows holds the SQLite file open until the process exits, so a failed
    // cleanup of a temp directory must not fail the suite.
  }
});
