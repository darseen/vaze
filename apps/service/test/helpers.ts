import { NextRequest } from "next/server";

/**
 * Stub for `authorizeRequest`. Route handlers all gate on it, and these tests
 * exercise what happens *after* that gate, so each suite mocks the module with
 * this factory rather than standing up a real session.
 */
export const authorizedStub = {
  default: async () => ({
    error: null,
    data: { user: { id: "test-user", username: "tester" } },
  }),
};

export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? null : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export interface UploadPart {
  name: string;
  content: string | Uint8Array;
}

export function uploadRequest(
  folder: string,
  parts: UploadPart[],
): NextRequest {
  const form = new FormData();
  form.append("folder", folder);

  for (const part of parts) {
    form.append(
      "files",
      new File([part.content as BlobPart], part.name, {
        type: "application/octet-stream",
      }),
    );
  }

  return new NextRequest("http://localhost/api/files", {
    method: "POST",
    body: form,
  });
}

export async function readJson<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
