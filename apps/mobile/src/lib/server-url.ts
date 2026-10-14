const LOCAL_HOST =
  /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\]|[^/]+\.local)(:\d+)?(\/|$)/i;

function clean(url: string) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) return null;
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** URLs worth trying for what the user typed, most likely first. */
export function candidateUrls(input: string): string[] {
  const value = input.trim().replace(/\/+$/, "");
  if (!value) return [];

  if (/^https?:\/\//i.test(value)) {
    const url = clean(value);
    return url ? [url] : [];
  }

  // LAN addresses are usually plain http, public hosts usually https
  const schemes = LOCAL_HOST.test(value)
    ? ["http", "https"]
    : ["https", "http"];
  return schemes
    .map((scheme) => clean(`${scheme}://${value}`))
    .filter((url): url is string => url !== null);
}

export function hostOf(url: string) {
  try {
    const { host, pathname } = new URL(url);
    return pathname === "/" ? host : `${host}${pathname}`;
  } catch {
    return url;
  }
}
