import type { Role, Scope } from "@darseen/vaze";
import { parseTimestamp } from "./format";

// mirrors SCOPE_INFO, ROLE_INFO and KEY_SCOPES in the service's lib/permissions.ts
export const SCOPE_INFO: Record<Scope, { label: string; description: string }> =
  {
    "files:read": {
      label: "View files",
      description:
        "Browse, preview and download files and folders, and create signed links.",
    },
    "files:write": {
      label: "Upload and edit files",
      description:
        "Upload files, create folders, rename, move, and change visibility.",
    },
    "files:delete": {
      label: "Delete files",
      description: "Delete files and folders.",
    },
    "api-keys:manage": {
      label: "API keys",
      description:
        "Create API keys and call the API with them. Existing keys stop working without it.",
    },
    "settings:manage": {
      label: "Instance settings",
      description:
        "Change the default visibility, limits and retention for everyone.",
    },
    "users:manage": {
      label: "Manage users",
      description: "Add, edit, disable and remove accounts.",
    },
  };

const ALL_SCOPES = Object.keys(SCOPE_INFO) as Scope[];

// managing users can grant anything, so only the admin role carries it
export const ASSIGNABLE_SCOPES = ALL_SCOPES.filter(
  (scope) => scope !== "users:manage",
);

export const ROLE_INFO: Record<
  Role,
  { label: string; description: string; scopes: Scope[] | null }
> = {
  admin: {
    label: "Admin",
    description: "Full access, including users and instance settings.",
    scopes: ALL_SCOPES,
  },
  editor: {
    label: "Editor",
    description: "Upload, edit and delete files, and use API keys.",
    scopes: ["files:read", "files:write", "files:delete", "api-keys:manage"],
  },
  viewer: {
    label: "Viewer",
    description: "Browse and download files.",
    scopes: ["files:read"],
  },
  custom: {
    label: "Custom",
    description: "Only the scopes you pick.",
    scopes: null,
  },
};

export const ALL_ROLES = Object.keys(ROLE_INFO) as Role[];

export function roleLabel(role: string) {
  return role in ROLE_INFO ? ROLE_INFO[role as Role].label : role;
}

export function hasEveryScope(scopes: Scope[]) {
  return scopes.length === ALL_SCOPES.length;
}

export const KEY_SCOPES = (
  ["files:read", "files:write", "files:delete"] as const
).map((scope) => ({ scope, ...SCOPE_INFO[scope] }));

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
