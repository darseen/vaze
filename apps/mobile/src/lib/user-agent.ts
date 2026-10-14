import Constants from "expo-constants";
import { Platform } from "react-native";

// mirrors utils/user-agent.ts in the service
const BROWSERS: [RegExp, string][] = [
  [/^Vaze\//, "Vaze app"],
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

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
  return browser ?? system ?? userAgent.split(" ")[0];
}

export function isMobileUserAgent(userAgent: string | null): boolean {
  return !!userAgent && /Mobile|Android|iPhone|iPad|iPod/.test(userAgent);
}

function systemName() {
  if (Platform.OS === "ios") {
    return `${Platform.isPad ? "iPad" : "iPhone"}; iOS ${Platform.Version}`;
  }
  if (Platform.OS === "android") {
    return `Android ${Platform.constants.Release}`;
  }
  return Platform.OS;
}

/** Sent when signing in, so the session reads as this app in the device list. */
export const APP_USER_AGENT = `Vaze/${Constants.expoConfig?.version ?? "1.0.0"} (${systemName()})`;
