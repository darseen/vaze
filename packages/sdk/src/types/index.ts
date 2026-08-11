import type Files from "../files.js";
import type Folders from "../folders.js";

export interface IVaze {
  files: Files;
  folders: Folders;
}

// type aliases (not interfaces) so they satisfy the Record-typed `params`
// argument of `Base.apiUrl` via their implicit index signatures
export type VazeOptions = {
  apiKey?: string;
  vazeUrl?: string;
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

export type BulkDeleteResult = {
  deleted: string[];
  failed: { id: string; message: string }[];
};
