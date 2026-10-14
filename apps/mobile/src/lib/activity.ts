import type { ActivityType } from "@darseen/vaze";
import {
  CircleCheck,
  CircleSlash,
  CircleX,
  FolderX,
  KeyRound,
  LockKeyhole,
  PencilLine,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react-native";
import { parseTimestamp } from "./format";

// the web activity page's green, red, zinc, amber and blue badges
const TONES = {
  success: { badge: "bg-success-soft", icon: "text-success" },
  danger: { badge: "bg-danger-soft", icon: "text-danger" },
  neutral: { badge: "bg-default", icon: "text-muted" },
  warning: { badge: "bg-warning-soft", icon: "text-warning" },
  info: { badge: "bg-folder-soft", icon: "text-folder" },
};

// mirrors TYPE_META in the web activity list
export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon; tone: (typeof TONES)[keyof typeof TONES] }
> = {
  "upload.succeeded": {
    label: "Upload complete",
    icon: CircleCheck,
    tone: TONES.success,
  },
  "upload.failed": {
    label: "Upload failed",
    icon: CircleX,
    tone: TONES.danger,
  },
  "upload.canceled": {
    label: "Upload canceled",
    icon: CircleSlash,
    tone: TONES.neutral,
  },
  "file.deleted": { label: "File deleted", icon: Trash2, tone: TONES.neutral },
  "file.delete-failed": {
    label: "File delete failed",
    icon: CircleX,
    tone: TONES.danger,
  },
  "folder.deleted": {
    label: "Folder deleted",
    icon: FolderX,
    tone: TONES.neutral,
  },
  "folder.delete-failed": {
    label: "Folder delete failed",
    icon: FolderX,
    tone: TONES.danger,
  },
  "api-key.created": {
    label: "API key created",
    icon: KeyRound,
    tone: TONES.warning,
  },
  "api-key.renamed": {
    label: "API key renamed",
    icon: PencilLine,
    tone: TONES.info,
  },
  "api-key.deleted": {
    label: "API key deleted",
    icon: Trash2,
    tone: TONES.danger,
  },
  "user.created": { label: "User added", icon: UserPlus, tone: TONES.success },
  "user.access-changed": {
    label: "User access changed",
    icon: UserCog,
    tone: TONES.info,
  },
  "user.password-reset": {
    label: "User password reset",
    icon: LockKeyhole,
    tone: TONES.warning,
  },
  "user.disabled": { label: "User disabled", icon: UserX, tone: TONES.neutral },
  "user.enabled": {
    label: "User enabled",
    icon: UserCheck,
    tone: TONES.success,
  },
  "user.deleted": {
    label: "User deleted",
    icon: UserMinus,
    tone: TONES.danger,
  },
};

export const ACTIVITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "uploads", label: "Uploads" },
  { value: "deletions", label: "Deletions" },
  { value: "api-keys", label: "API keys" },
  { value: "users", label: "Users" },
] as const;

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]["value"];

export function matchesFilter(type: ActivityType, filter: ActivityFilter) {
  if (filter === "uploads") return type.startsWith("upload.");
  if (filter === "deletions")
    return type.startsWith("file.") || type.startsWith("folder.");
  if (filter === "api-keys") return type.startsWith("api-key.");
  if (filter === "users") return type.startsWith("user.");
  return true;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "Today", "Yesterday" or the date, for grouping entries by day. */
export function dayLabel(value: string) {
  const date = parseTimestamp(value);
  const days = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
