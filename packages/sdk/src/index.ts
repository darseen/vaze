import type { Me, Stats } from "@repo/types";
import Base from "./base.js";
import Files from "./files.js";
import Folders from "./folders.js";
import type { IVaze, VazeOptions } from "./types/index.js";
import { constructFileUrls } from "./utils/index.js";

export default class Vaze extends Base implements IVaze {
  public files: Files;
  public folders: Folders;

  constructor(options: VazeOptions = {}) {
    super(options);

    this.files = new Files(options);
    this.folders = new Folders(options);
  }

  public async health() {
    return await this.request<{ message: string }>(
      "GET",
      this.apiUrl("/api/health"),
    );
  }

  /** The caller's account and the scopes it may use. */
  public async me() {
    return await this.request<Me>("GET", this.apiUrl("/api/me"));
  }

  /** Dashboard numbers, with each section limited to the caller's scopes. */
  public async stats() {
    const { data, error } = await this.request<Stats>(
      "GET",
      this.apiUrl("/api/stats"),
    );
    const files = data?.files;

    return {
      error,
      data: data
        ? {
            ...data,
            files: files
              ? {
                  ...files,
                  largest: constructFileUrls({
                    vazeUrl: this.vazeUrl,
                    files: files.largest,
                  }),
                  recent: constructFileUrls({
                    vazeUrl: this.vazeUrl,
                    files: files.recent,
                  }),
                }
              : null,
          }
        : null,
    };
  }
}

export type {
  ApiResponse,
  FileWithUrl as File,
  Folder,
  Me,
  Role,
  Scope,
  Stats,
  Visibility,
} from "@repo/types";
export type {
  BulkDeleteResult,
  BulkMoveResult,
  FileReference,
  ListOptions,
  MoveDestination,
  SignedUrl,
  SignOptions,
  VazeHeaders,
  VazeOptions,
} from "./types/index.js";
