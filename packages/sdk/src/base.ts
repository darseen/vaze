import type { ApiResponse } from "@repo/types";

export default class Base {
  private apiKey: string;

  protected vazeUrl: string;

  constructor(options: { apiKey?: string; vazeUrl?: string } = {}) {
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
    this.vazeUrl = vazeUrl;
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

      if (!isFormData && !fetchHeaders["Content-Type"]) {
        fetchHeaders["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: isFormData ? body : JSON.stringify(body),
      });

      return (await response.json()) as ApiResponse<T>;
    } catch (error) {
      console.log("Request error:", error);
      return {
        data: null,
        error: {
          message: "An error occurred while making the request.",
        },
      };
    }
  }
}
