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

import type { File, Scope, User } from "@repo/db";

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
