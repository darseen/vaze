import type { DeletedItem } from "@darseen/vaze";
import { parseTimestamp, timeUntil } from "./format";

// an item this close to its purge is called out, like the web
const SOON_MS = 3 * 24 * 60 * 60 * 1000;

export const purgesSoon = (item: DeletedItem) =>
  parseTimestamp(item.purgeAt).getTime() - Date.now() < SOON_MS;

export function removal(item: DeletedItem) {
  const left = timeUntil(item.purgeAt);
  return left ? `Removed in ${left}` : "Removed soon";
}

/** The folder a deleted item was in, as the file browser names it. */
export function deletedFrom(key: string) {
  const slash = key.lastIndexOf("/");
  return slash === -1 ? "All files" : key.slice(0, slash);
}
