import type { ApiResponse } from "@repo/types";
import type { VazeOptions } from "./types/index.js";
import { parseContentDispositionFilename } from "./utils/index.js";

export default class Base {
  private apiKey: string;

  protected vazeUrl: string;

  constructor(options: VazeOptions = {}) {
    const vazeUrl = options.vazeUrl || process.env.VAZE_URL;
    const apiKey = options.apiKey || process.env.VAZE_API_KEY;

    if (!vazeUrl) {
      throw new Error(
        "You must provide a Vaze URL or set the VAZE_URL environment variable.",
      );
    }

    if (!apiKey) {
      throw new Error(
        "You must provide an API key or set the VAZE_API_KEY environment variable.",
      );
    }

    this.apiKey = apiKey;
    // A trailing slash makes `new URL(relativePath, base)` preserve a base
    // path in the URL (e.g. https://host/vaze) instead of dropping it.
    this.vazeUrl = vazeUrl.endsWith("/") ? vazeUrl : `${vazeUrl}/`;
  }

  protected apiUrl(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(path.replace(/^\//, ""), this.vazeUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  protected async request<T>(
    method: string,
    url: string,
    body?: Record<string, any> | FormData,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    try {
      const fetchHeaders: Record<string, string> = {
        "API-Key": this.apiKey,
        ...headers,
      };
      const isFormData = body instanceof FormData;

      if (body !== undefined && !isFormData && !fetchHeaders["Content-Type"]) {
        fetchHeaders["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: isFormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : null,
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return {
          data: null,
          error: {
            message: `Unexpected non-JSON response from server (status ${response.status}).`,
          },
        };
      }

      const result = (await response.json()) as ApiResponse<T>;

      if (!response.ok && !result.error) {
        return {
          data: null,
          error: { message: `Request failed with status ${response.status}.` },
        };
      }

      return result;
    } catch (error) {
      return {
        data: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "An error occurred while making the request.",
        },
      };
    }
  }

  protected async requestBlob(url: string): Promise<
    ApiResponse<{ blob: Blob; filename: string | null; contentType: string }>
  > {
    try {
      const response = await fetch(url, {
        headers: { "API-Key": this.apiKey },
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const result = (await response.json()) as ApiResponse<never>;
          if (result.error) return { data: null, error: result.error };
        }
        return {
          data: null,
          error: { message: `Request failed with status ${response.status}.` },
        };
      }

      return {
        data: {
          blob: await response.blob(),
          filename: parseContentDispositionFilename(
            response.headers.get("content-disposition"),
          ),
          contentType,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "An error occurred while making the request.",
        },
      };
    }
  }
}
