import type { FileWithUrl, Limits, Role, Scope, Visibility } from "@repo/types";
import type Account from "../account.js";
import type Activity from "../activity.js";
import type Files from "../files.js";
import type Folders from "../folders.js";
import type Keys from "../keys.js";
import type Settings from "../settings.js";
import type Users from "../users.js";

export interface IVaze {
  files: Files;
  folders: Folders;
  keys: Keys;
  account: Account;
  activity: Activity;
  users: Users;
  settings: Settings;
}

export type VazeHeaders =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

// type aliases (not interfaces) so they satisfy the Record-typed `params`
// argument of `Base.apiUrl` via their implicit index signatures
export type VazeOptions = {
  apiKey?: string;
  vazeUrl?: string;
  /**
   * Headers sent with every request, such as a Better Auth session cookie.
   * A function is called before each request. Replaces the need for `apiKey`.
   */
  headers?: VazeHeaders;
  /** Replaces the global `fetch`, e.g. to set `credentials` or a timeout. */
  fetch?: typeof fetch;
};

/** A file on disk in React Native, which streams it from `uri` on upload. */
export type FileReference = {
  uri: string;
  name: string;
  type: string;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "name" | "size";
  orderDirection?: "ASC" | "DESC";
};

export type SignOptions = {
  id?: string;
  key?: string;
  /** Seconds the link stays valid. Capped server-side, default one hour. */
  expiresIn?: number;
};

export type SignedUrl = {
  url: string;
  expiresAt: string;
};

export type MoveDestination = {
  /** The destination folder's id. Either this or `folder` is required. */
  folderId?: string;
  /** The destination folder's key, created if missing; `""` is the root. */
  folder?: string;
};

export type BulkMoveResult = {
  files: FileWithUrl[];
  failed: { id: string; message: string }[];
};

export type NewKeyOptions = {
  name: string;
  /** Only `files:read`, `files:write` and `files:delete`, and only ones the caller holds. */
  scopes: Scope[];
  /** Leave it out, or pass `null`, for a key that never expires. */
  expiresAt?: Date | string | null;
};

export type ProfileChanges = {
  name?: string;
  /** The new sign-in email; it applies right away. */
  email?: string;
};

export type PasswordChange = {
  currentPassword: string;
  /** At least 8 characters. */
  newPassword: string;
  /** Signs out every other device too. */
  revokeOtherSessions?: boolean;
};

export type UserAccess = {
  role: Role;
  /** Only read for the `custom` role, which needs at least one. `users:manage` can't be picked. */
  scopes?: Scope[];
};

export type NewUserOptions = UserAccess & {
  name: string;
  email: string;
  /** At least 8 characters. */
  password: string;
};

export type SettingsChanges = {
  defaultVisibility?: Visibility;
  limits?: Partial<Limits>;
};

export type BulkDeleteResult = {
  deleted: string[];
  failed: { id: string; message: string }[];
};
