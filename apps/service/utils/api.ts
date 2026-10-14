import type { ApiResponse } from "@repo/types";

/** Calls the instance's own REST API from the dashboard, as the signed-in user. */
export async function callApi<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const response = await fetch(
    path,
    body === undefined
      ? { method }
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  return (await response.json()) as ApiResponse<T>;
}
