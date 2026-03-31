import type { FileWithUrl, Folder } from "@repo/types";
import Base from "./base.js";

export default class Folders extends Base {
  public async get(options?: {
    id?: string;
    path?: string;
    limit?: number;
    offset?: number;
    orderBy?: "created_at" | "updated_at" | "name";
    orderDirection?: "ASC" | "DESC";
  }) {
    const url = new URL("/api/folders", this.vazeUrl);
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        url.searchParams.set(key, value.toString());
      }
    }

    return await this.request<{ files: FileWithUrl[]; folders: Folder[] }>(
      "GET",
      url.toString(),
    );
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
