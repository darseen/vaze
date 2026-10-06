// order matters: Edge and Opera also claim Chrome, Chrome also claims Safari
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

// iOS claims "like Mac OS X", Android and ChromeOS also claim Linux
const SYSTEMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

function match(userAgent: string, patterns: [RegExp, string][]) {
  return patterns.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/** A short "Browser on OS" label for a session's user agent. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = match(userAgent, BROWSERS);
  const system = match(userAgent, SYSTEMS);

  if (browser && system) return `${browser} on ${system}`;
  // non-browser clients, e.g. "curl/8.5.0"
  return browser ?? system ?? userAgent.split(" ")[0];
}

export function isMobileUserAgent(userAgent: string | null): boolean {
  return !!userAgent && /Mobile|Android|iPhone|iPad|iPod/.test(userAgent);
}
