const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[exponent]}`;
}

export function formatDuration(totalSeconds: number) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(totalSeconds, 0) : 0;
  const seconds = Math.floor(safe % 60);
  const minutes = Math.floor(safe / 60) % 60;
  const hours = Math.floor(safe / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** SQLite's CURRENT_TIMESTAMP is UTC without a zone marker. */
export function parseTimestamp(value: string) {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value.replace(" ", "T")}Z`);
  }
  return new Date(value);
}

export function formatDate(value: string) {
  return parseTimestamp(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string) {
  return parseTimestamp(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value: string) {
  const seconds = (Date.now() - parseTimestamp(value).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

/** Shortens an IPv6 address the way the web's device list does. */
export function formatIpAddress(ip: string): string {
  if (!ip.includes(":") || ip.includes("::")) return ip;

  const groups = ip.split(":").map((group) => group.replace(/^0+(?=.)/, ""));

  // the longest run of two or more zero groups collapses to "::"
  let start = -1;
  let length = 0;
  for (let i = 0; i < groups.length; i++) {
    let end = i;
    while (groups[end] === "0") end++;
    if (end - i > Math.max(length, 1)) {
      start = i;
      length = end - i;
    }
  }

  if (start === -1) return groups.join(":");
  return `${groups.slice(0, start).join(":")}::${groups.slice(start + length).join(":")}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
