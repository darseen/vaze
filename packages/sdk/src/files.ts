import type { FileWithUrl, Visibility } from "@repo/types";
import Base from "./base.js";
import type {
  BulkDeleteResult,
  ListOptions,
  SignedUrl,
  SignOptions,
} from "./types/index.js";
import { constructFileUrls } from "./utils/index.js";

export default class Files extends Base {
  public async getAll(options?: ListOptions) {
    const url = this.apiUrl("/api/files", options);

    const { error, data } = await this.request<{ files: FileWithUrl[] }>(
      "GET",
      url,
    );

    return {
      error,
      data: data
        ? {
            files: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: data.files,
            }),
          }
        : null,
    };
  }

  public async getById(id: string) {
    const url = this.apiUrl("/api/files", { id });

    const { data, error } = await this.request<{ file: FileWithUrl }>(
      "GET",
      url,
    );

    return {
      error,
      data: data
        ? {
            file: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: [data.file],
            })[0],
          }
        : null,
    };
  }

  public async getByKey(key: string) {
    const url = this.apiUrl("/api/files", { key });

    const { data, error } = await this.request<{ file: FileWithUrl }>(
      "GET",
      url,
    );

    return {
      error,
      data: data
        ? {
            file: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: [data.file],
            })[0],
          }
        : null,
    };
  }

  public async getByName(name: string, options?: ListOptions) {
    const url = this.apiUrl("/api/files", { name, ...options });

    const { error, data } = await this.request<{ files: FileWithUrl[] }>(
      "GET",
      url,
    );

    return {
      error,
      data: data
        ? {
            files: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: data.files,
            }),
          }
        : null,
    };
  }

  public async upload(data: {
    files: File[];
    folder?: string;
    visibility?: Visibility;
  }) {
    const { files, folder, visibility } = data;
    const url = this.apiUrl("/api/files");
    const formData = new FormData();

    if (folder) formData.append("folder", folder);
    if (visibility) formData.append("visibility", visibility);

    files.forEach((file) => {
      formData.append("files", file);
    });

    const { error, data: responseData } = await this.request<{
      files: FileWithUrl[];
    }>("POST", url, formData);

    return {
      error,
      data: responseData
        ? {
            files: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: responseData.files,
            }),
          }
        : null,
    };
  }

  public async download(id: string) {
    const url = this.apiUrl(`/api/files/download/${encodeURIComponent(id)}`);
    return await this.requestBlob(url);
  }

  public async rename(data: { id: string; name: string }) {
    return await this.request<null>("PUT", this.apiUrl("/api/files"), data);
  }

  public async setVisibility(data: { id: string; visibility: Visibility }) {
    return await this.request<null>("PUT", this.apiUrl("/api/files"), data);
  }

  /** Mint a time-limited URL that reads a file without an API key. */
  public async sign(options: SignOptions) {
    const { data, error } = await this.request<SignedUrl>(
      "POST",
      this.apiUrl("/api/files/sign"),
      options,
    );

    return {
      error,
      data: data
        ? { ...data, url: new URL(data.url, this.vazeUrl).toString() }
        : null,
    };
  }

  public async delete(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/files"), {
      id,
    });
  }

  /** Delete several files in one request; each id reports its own outcome. */
  public async deleteMany(ids: string[]) {
    return await this.request<BulkDeleteResult>(
      "DELETE",
      this.apiUrl("/api/files"),
      { ids },
    );
  }
}
