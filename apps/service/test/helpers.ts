import { NextRequest } from "next/server";

const authState = { authorized: true };

/**
 * Stub for `authorizeRequest`. Route handlers all gate on it, and these tests
 * exercise what happens *after* that gate, so each suite mocks the module with
 * this factory rather than standing up a real session. It resolves `authState`
 * per call so `anonymously` can flip it.
 */
export const authorizedStub = {
  default: async () =>
    authState.authorized
      ? {
          error: null,
          data: { user: { id: "test-user", username: "tester" } },
        }
      : { error: { message: "Unauthorized", status: 401 }, data: null },
};

/** Run `fn` as an unauthenticated caller. */
export async function anonymously<T>(fn: () => Promise<T>): Promise<T> {
  authState.authorized = false;
  try {
    return await fn();
  } finally {
    authState.authorized = true;
  }
}

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
  visibility?: "public" | "private",
): NextRequest {
  const form = new FormData();
  form.append("folder", folder);
  if (visibility) form.append("visibility", visibility);

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
