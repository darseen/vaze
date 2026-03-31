import type { FileWithUrl as File } from "@repo/types";
import Base from "./base.js";

export default class Files extends Base {
  public async getAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: "created_at" | "updated_at" | "name" | "size";
    orderDirection?: "ASC" | "DESC";
  }) {
    const url = new URL("/api/files", this.vazeUrl);
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        url.searchParams.set(key, value.toString());
      }
    }

    return await this.request<{ files: File[] }>("GET", url.toString());
  }

  public async getById(id: string) {
    const url = new URL(`/api/files`, this.vazeUrl);
    url.searchParams.set("id", id);

    return await this.request<{ file: File }>("GET", url.toString());
  }

  public async getByName(
    name: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: "created_at" | "updated_at" | "name" | "size";
      orderDirection?: "ASC" | "DESC";
    },
  ) {
    const url = new URL(`/api/files`, this.vazeUrl);
    url.searchParams.set("name", name);
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        url.searchParams.set(key, value.toString());
      }
    }

    return await this.request<{ files: File[] }>("GET", url.toString());
  }

  public async upload(data: { files: File[]; folder?: string }) {
    const { files, folder } = data;
    const url = new URL("/api/files", this.vazeUrl);
    const formData = new FormData();

    if (folder) formData.append("folder", folder);

    files.forEach((file) => {
      formData.append("files", file);
    });

    return await this.request<{ files: File[] }>(
      "POST",
      url.toString(),
      formData,
    );
  }

  public async rename(data: { id: string; name: string }) {
    const url = new URL(`/api/files`, this.vazeUrl);
    return await this.request<null>("PUT", url.toString(), data);
  }

  public async delete(id: string) {
    const url = new URL(`/api/files`, this.vazeUrl);
    return await this.request<null>("DELETE", url.toString(), { id });
  }
}
