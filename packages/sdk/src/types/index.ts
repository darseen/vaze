import type { FileWithUrl, Scope } from "@repo/types";
import type Files from "../files.js";
import type Folders from "../folders.js";
import type Keys from "../keys.js";

export interface IVaze {
  files: Files;
  folders: Folders;
  keys: Keys;
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

export type BulkDeleteResult = {
  deleted: string[];
  failed: { id: string; message: string }[];
};
