import { accessSync } from "node:fs";
import { access, constants } from "node:fs/promises";

export async function accessPath(path: string) {
  return await access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export function accessPathSync(path: string) {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
