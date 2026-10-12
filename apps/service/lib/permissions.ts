import type { Role, Scope } from "@repo/types";

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

export const ALL_SCOPES = Object.keys(SCOPE_INFO) as Scope[];

// managing users can grant anything, so only the admin role carries it
export const ASSIGNABLE_SCOPES: Scope[] = ALL_SCOPES.filter(
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

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && Object.hasOwn(ROLE_INFO, value);
}

/** Keep only assignable scopes, in a stable order. */
export function normalizeScopes(values: unknown): Scope[] {
  if (!Array.isArray(values)) return [];
  return ASSIGNABLE_SCOPES.filter((scope) => values.includes(scope));
}

export function parseScopes(value: string | null | undefined): Scope[] {
  return normalizeScopes(value ? value.split(",") : []);
}

// the API only checks these; the rest guard dashboard pages
export const KEY_SCOPES: Scope[] = [
  "files:read",
  "files:write",
  "files:delete",
];

/** Keep only scopes an API key can carry, in a stable order. */
export function normalizeKeyScopes(values: unknown): Scope[] {
  if (!Array.isArray(values)) return [];
  return KEY_SCOPES.filter((scope) => values.includes(scope));
}

export function parseKeyScopes(value: string | null | undefined): Scope[] {
  return normalizeKeyScopes(value ? value.split(",") : []);
}

export interface Grantee {
  role?: string | null;
  scopes?: string | null;
}

/** Every scope a user holds; Better Auth stores several roles comma-joined. */
export function scopesOf(user: Grantee): Scope[] {
  const granted = new Set<Scope>();

  for (const role of (user.role ?? "").split(",")) {
    if (!isRole(role)) continue;
    for (const scope of ROLE_INFO[role].scopes ?? parseScopes(user.scopes)) {
      granted.add(scope);
    }
  }

  return ALL_SCOPES.filter((scope) => granted.has(scope));
}

export function hasScope(user: Grantee, scope: Scope): boolean {
  return scopesOf(user).includes(scope);
}

/** A ban with an expiry in the past no longer applies. */
export function isDisabled(user: {
  banned?: boolean | null;
  banExpires?: Date | null;
}): boolean {
  if (!user.banned) return false;
  return !user.banExpires || user.banExpires.getTime() > Date.now();
}
