export type {
  Account,
  Activity,
  ActivityType,
  ApiKey,
  ApiRequest,
  File,
  Folder,
  Role,
  Scope,
  Session,
  Settings,
  User,
  Verification,
  Visibility,
} from "@repo/db";

import type { Activity, File, Role, Scope, User, Visibility } from "@repo/db";

export type ApiResponse<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      /** `status` is the HTTP status, absent when no response arrived. */
      error: { message: string; status?: number };
    };

export type FileWithUrl = File & { url: string };

export type Me = {
  user: Pick<User, "id" | "name" | "email" | "image" | "role">;
  /** What this caller may do; an API key is capped by its own scopes. */
  scopes: Scope[];
};

/** An API key as its owner sees it; the secret itself is never stored. */
export type ApiKeySummary = {
  id: string;
  name: string;
  /** Capped by the owner's current role on every request. */
  scopes: Scope[];
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
};

/** A key just created, with the secret that is only returned this once. */
export type CreatedApiKey = ApiKeySummary & { key: string };

/** One row of the caller's activity history. */
export type ActivityEntry = Pick<
  Activity,
  "id" | "type" | "target" | "detail" | "createdAt"
>;

/** A device signed in to the caller's account. */
export type SessionSummary = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  /** The session making this request. */
  current: boolean;
};

/** An account as an admin sees it. */
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** What the account can actually do. */
  scopes: Scope[];
  /** The picks saved for the custom role, kept to prefill an editor. */
  customScopes: Scope[];
  disabled: boolean;
  apiKeys: number;
  createdAt: string;
};

/** Byte, second and day limits an admin can change at runtime. */
export type Limits = {
  maxUploadSize: number;
  defaultPresignTtl: number;
  maxPresignTtl: number;
  hostingCacheMaxAge: number;
  activityRetentionDays: number;
  apiRequestRetentionDays: number;
};

export type InstanceSettings = {
  /** Applied to uploads and new folders that don't ask for one. */
  defaultVisibility: Visibility;
  /** How many existing files are public and private. */
  visibilityCounts: Record<Visibility, number>;
  limits: Limits;
};

export type Stats = {
  /** Present when the caller holds `files:read`. */
  files: {
    total: number;
    folders: number;
    storage: { used: number; available: number };
    types: { mimeType: string; size: number; count: number }[];
    largest: FileWithUrl[];
    recent: FileWithUrl[];
  } | null;
  /** Present for signed-in users holding `api-keys:manage`. */
  apiKeys: {
    total: number;
    /** The last seven UTC days, oldest first. */
    requests: { date: string; count: number }[];
  } | null;
};
