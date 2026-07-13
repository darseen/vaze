/**
 * Parse a timestamp coming from the database. SQLite's `CURRENT_TIMESTAMP`
 * produces `"YYYY-MM-DD HH:MM:SS"` in UTC with no timezone marker, which
 * `new Date()` would otherwise interpret as *local* time. ISO strings (used for
 * api-key timestamps) already carry a `Z` and pass straight through.
 */
export const parseTimestamp = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(" ", "T") + "Z");
  }
  return new Date(value);
};

export const formatDate = (date: string | null) => {
  if (!date) return;

  return parseTimestamp(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
