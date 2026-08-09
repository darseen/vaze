import type { FileWithUrl, Folder, Visibility } from "@repo/types";
import Base from "./base.js";
import type { ListOptions } from "./types/index.js";
import { constructFileUrls } from "./utils/index.js";

export default class Folders extends Base {
  public async get(
    options?: ListOptions & { id?: string; key?: string; path?: string },
  ) {
    const url = this.apiUrl("/api/folders", options);

    const { error, data } = await this.request<{
      files: FileWithUrl[];
      folders: Folder[];
    }>("GET", url);

    return {
      error,
      data: data
        ? {
            files: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: data.files,
            }),
            folders: data.folders,
          }
        : null,
    };
  }

  public async create(folder: string) {
    return await this.request<{ folder: Folder }>(
      "POST",
      this.apiUrl("/api/folders"),
      { folder },
    );
  }

  public async rename(data: { id: string; name: string }) {
    return await this.request<null>("PUT", this.apiUrl("/api/folders"), data);
  }

  /** Apply a visibility to every file at or below this folder. */
  public async setVisibility(data: { id: string; visibility: Visibility }) {
    return await this.request<null>("PUT", this.apiUrl("/api/folders"), data);
  }

  public async delete(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/folders"), {
      id,
    });
  }
}
