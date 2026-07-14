import type { FileWithUrl as File, Folder } from "@repo/types";
import Base from "./base.js";
import { constructFileUrls } from "./utils/index.js";

export default class Folders extends Base {
  public async get(options?: {
    id?: string;
    path?: string;
    limit?: number;
    offset?: number;
    orderBy?: "createdAt" | "updatedAt" | "name";
    orderDirection?: "ASC" | "DESC";
  }) {
    const url = new URL("/api/folders", this.vazeUrl);
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        url.searchParams.set(key, value.toString());
      }
    }

    const { error, data } = await this.request<{
      files: File[];
      folders: Folder[];
    }>("GET", url.toString());

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
    const url = new URL("/api/folders", this.vazeUrl);
    return await this.request<{ folder: Folder }>("POST", url.toString(), {
      folder,
    });
  }

  public async rename(data: { id: string; name: string }) {
    const url = new URL("/api/folders", this.vazeUrl);
    return await this.request<null>("PUT", url.toString(), data);
  }

  public async delete(id: string) {
    const url = new URL("/api/folders", this.vazeUrl);
    return await this.request<null>("DELETE", url.toString(), { id });
  }
}
