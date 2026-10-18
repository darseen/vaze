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

/** One API key's share of the week's requests. */
export type ApiKeyUsage = {
  id: string;
  name: string;
  /** Requests over the same seven UTC days as `Stats["apiKeys"]["requests"]`. */
  requests: number;
  lastUsed: string | null;
  expiresAt: string | null;
};

/** Public hosting traffic for one UTC day. */
export type TrafficDay = {
  date: string;
  /** Responses that served a file: 200, 206 and 304. */
  requests: number;
  /** Body bytes streamed out. */
  bytes: number;
  /** Requests for keys that matched no file the caller could read. */
  notFound: number;
};

/** Something on the instance worth acting on. */
export type StatsAlert =
  /** The data volume has less than a tenth of its space left. */
  | { type: "storage-low"; available: number; capacity: number }
  /** The caller's own uploads that failed over the last seven days. */
  | { type: "uploads-failed"; count: number; latest: string }
  /** The caller's own file and folder deletes that failed over the last seven days. */
  | { type: "deletes-failed"; count: number; latest: string }
  /** The caller's keys past their expiry date, which no longer work. */
  | { type: "keys-expired"; count: number }
  /** The caller's keys that expire within seven days. */
  | { type: "keys-expiring"; count: number }
  /** The caller's keys not used for 30 days. */
  | { type: "keys-unused"; count: number };

/**
 * Fields marked optional were added after the first release of this endpoint.
 * Servers that predate them leave them out, so check before reading.
 */
export type Stats = {
  /** Present when the caller holds `files:read`. */
  files: {
    total: number;
    folders: number;
    storage: {
      /** Bytes taken by stored files. */
      used: number;
      /** Bytes free on the data volume. */
      available: number;
      /** Usable size of the data volume, which other data may share. */
      capacity?: number;
    };
    types: { mimeType: string; size: number; count: number }[];
    largest: FileWithUrl[];
    recent: FileWithUrl[];
    /** Files and bytes per visibility. */
    visibility?: Record<Visibility, { count: number; size: number }>;
    /**
     * Files added per UTC day over the last 30 days, oldest first. Only files
     * still stored count, so deleting a file removes it from its day.
     */
    added?: { date: string; count: number; size: number }[];
  } | null;
  /** Present for signed-in users holding `api-keys:manage`. */
  apiKeys: {
    total: number;
    /** The last seven UTC days, oldest first. */
    requests: { date: string; count: number }[];
    /**
     * Every key with its requests over the same days, busiest first. Requests
     * made with keys deleted since count in `requests` but in no key here.
     */
    keys?: ApiKeyUsage[];
  } | null;
  /**
   * Public hosting traffic over the last 30 UTC days. Present when the caller
   * holds `files:read`. Requests made from a signed-in dashboard or app
   * session aren't counted.
   */
  hosting?: {
    /** Oldest first. */
    days: TrafficDay[];
    /** The five files requested most over those days. */
    top: { file: FileWithUrl; requests: number; bytes: number }[];
  } | null;
  /** Present for signed-in users holding `users:manage`. */
  users?: {
    total: number;
    disabled: number;
    /** Devices signed in across every account. */
    sessions: number;
  } | null;
  /** Empty when nothing needs attention. New types may be added later. */
  alerts?: StatsAlert[];
};
