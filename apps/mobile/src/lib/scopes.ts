import type { Scope } from "@darseen/vaze";
import { parseTimestamp } from "./format";

// mirrors KEY_SCOPES and SCOPE_INFO in the service's lib/permissions.ts
export const KEY_SCOPES: {
  scope: Scope;
  label: string;
  description: string;
}[] = [
  {
    scope: "files:read",
    label: "View files",
    description:
      "Browse, preview and download files and folders, and create signed links.",
  },
  {
    scope: "files:write",
    label: "Upload and edit files",
    description:
      "Upload files, create folders, rename, move, and change visibility.",
  },
  {
    scope: "files:delete",
    label: "Delete files",
    description: "Delete files and folders.",
  },
];

export const EXPIRY_OPTIONS: { label: string; ms: number | null }[] = [
  { label: "Never", ms: null },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "90 days", ms: 90 * 24 * 60 * 60 * 1000 },
  { label: "1 year", ms: 365 * 24 * 60 * 60 * 1000 },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const timeOf = (value: string) => parseTimestamp(value).getTime();

/** The web dashboard's rule: used within the last day. */
export function isKeyActive(lastUsed: string | null) {
  return lastUsed !== null && Date.now() - timeOf(lastUsed) <= DAY_MS;
}

export function isExpired(expiresAt: string | null) {
  return expiresAt !== null && timeOf(expiresAt) <= Date.now();
}

export function isExpiringSoon(expiresAt: string | null) {
  return expiresAt !== null && timeOf(expiresAt) <= Date.now() + 7 * DAY_MS;
}
