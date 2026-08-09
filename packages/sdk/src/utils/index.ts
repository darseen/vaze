import type { FileWithUrl } from "@repo/types";

export function constructFileUrls({
  vazeUrl,
  files,
}: {
  vazeUrl: string;
  files: FileWithUrl[];
}) {
  // `file.url` is a relative path (`api/hosting/<key>`); resolving it against
  // a trailing-slash base keeps any base path and avoids double slashes.
  const base = vazeUrl.endsWith("/") ? vazeUrl : `${vazeUrl}/`;
  return files.map((file) => ({
    ...file,
    url: new URL(file.url, base).toString(),
  }));
}

export function parseContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) return null;

  // Prefer the RFC 5987 `filename*` form, which carries the real
  // (possibly non-ASCII) name.
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // malformed encoding — fall back to the plain filename
    }
  }

  const plainMatch = header.match(/filename="([^"]*)"/i);
  return plainMatch?.[1] ?? null;
}
