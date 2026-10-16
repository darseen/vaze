import type { FileWithUrl, Visibility } from "@repo/types";
import Base from "./base.js";
import type {
  BulkDeleteResult,
  BulkMoveResult,
  FileReference,
  ListOptions,
  MoveDestination,
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
    files: (File | FileReference)[];
    folder?: string;
    visibility?: Visibility;
  }) {
    const { files, folder, visibility } = data;
    const url = this.apiUrl("/api/files");
    const formData = new FormData();

    if (folder) formData.append("folder", folder);
    if (visibility) formData.append("visibility", visibility);

    files.forEach((file) => {
      // React Native's FormData reads uri, name and type off a plain object
      formData.append("files", file as Blob);
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
    return await this.requestBlob(this.downloadUrl(id));
  }

  /** Where `download` reads from; fetch it yourself with `authHeaders()`. */
  public downloadUrl(id: string) {
    return this.apiUrl(`/api/files/download/${encodeURIComponent(id)}`);
  }

  /** A WebP thumbnail of an image file; fetch it with `authHeaders()`. */
  public thumbnailUrl(id: string) {
    return this.apiUrl(`/api/files/thumbnail/${encodeURIComponent(id)}`);
  }

  /** Download several files as one zip, with paths below their shared folder. */
  public async downloadMany(ids: string[]) {
    return await this.requestBlob(this.downloadManyUrl(), "POST", { ids });
  }

  /** Where `downloadMany` posts `{ ids }`; stream it yourself with `authHeaders()`. */
  public downloadManyUrl() {
    return this.apiUrl("/api/files/download");
  }

  public async rename(data: { id: string; name: string }) {
    return await this.request<null>("PUT", this.apiUrl("/api/files"), data);
  }

  public async setVisibility(data: { id: string; visibility: Visibility }) {
    return await this.request<null>("PUT", this.apiUrl("/api/files"), data);
  }

  /** Move a file into another folder; its key and URL change with it. */
  public async move(data: { id: string } & MoveDestination) {
    const { data: responseData, error } = await this.request<{
      file: FileWithUrl;
    }>("POST", this.apiUrl("/api/files/move"), data);

    return {
      error,
      data: responseData
        ? {
            file: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: [responseData.file],
            })[0],
          }
        : null,
    };
  }

  /** Move several files into one folder; each id reports its own outcome. */
  public async moveMany(ids: string[], destination: MoveDestination) {
    const { data, error } = await this.request<BulkMoveResult>(
      "POST",
      this.apiUrl("/api/files/move"),
      { ids, ...destination },
    );

    return {
      error,
      data: data
        ? {
            files: constructFileUrls({
              vazeUrl: this.vazeUrl,
              files: data.files,
            }),
            failed: data.failed,
          }
        : null,
    };
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
