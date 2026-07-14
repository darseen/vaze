import type { FileWithUrl } from "@repo/types";
import Base from "./base.js";
import type { ListOptions } from "./types/index.js";
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

  public async upload(data: { files: File[]; folder?: string }) {
    const { files, folder } = data;
    const url = this.apiUrl("/api/files");
    const formData = new FormData();

    if (folder) formData.append("folder", folder);

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

  public async delete(id: string) {
    return await this.request<null>("DELETE", this.apiUrl("/api/files"), {
      id,
    });
  }
}
