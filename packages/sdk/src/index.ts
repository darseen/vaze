import Base from "./base.js";
import Files from "./files.js";
import Folders from "./folders.js";
import type { IVaze } from "./types/index.js";

export default class Vaze extends Base implements IVaze {
  public files: Files;
  public folders: Folders;

  constructor(options: { apiKey?: string; vazeUrl?: string } = {}) {
    super(options);

    this.files = new Files();
    this.folders = new Folders();
  }
}

export type { ApiResponse, FileWithUrl as File, Folder } from "@repo/types";
