import Base from "./base.js";
import Files from "./files.js";
import Folders from "./folders.js";
import type { IVaze, VazeOptions } from "./types/index.js";

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
}

export type {
  ApiResponse,
  FileWithUrl as File,
  Folder,
  Visibility,
} from "@repo/types";
export type {
  ListOptions,
  SignedUrl,
  SignOptions,
  VazeOptions,
} from "./types/index.js";
