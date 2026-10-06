import {
  ACTIVITY_RETENTION_DAYS,
  API_REQUEST_RETENTION_DAYS,
  DEFAULT_FILE_VISIBILITY,
  DEFAULT_PRESIGN_TTL_SECONDS,
  HOSTING_CACHE_MAX_AGE,
  MAX_PRESIGN_TTL_SECONDS,
  MAX_UPLOAD_SIZE,
} from "@/constants";
import { db, SETTINGS_ID } from "@/db";
import { settings } from "@repo/db";
import type { Visibility } from "@repo/types";
import { eq, sql } from "drizzle-orm";

/** Byte, second and day limits an admin can change at runtime. */
export interface Limits {
  maxUploadSize: number;
  defaultPresignTtl: number;
  maxPresignTtl: number;
  hostingCacheMaxAge: number;
  activityRetentionDays: number;
  apiRequestRetentionDays: number;
}

function readSettings() {
  return db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
}

/** Visibility applied to an upload that does not ask for one. */
export function getDefaultVisibility(): Visibility {
  return readSettings()?.defaultVisibility ?? DEFAULT_FILE_VISIBILITY;
}

export function getLimits(): Limits {
  const row = readSettings();

  return {
    maxUploadSize: row?.maxUploadSize ?? MAX_UPLOAD_SIZE,
    defaultPresignTtl: row?.defaultPresignTtl ?? DEFAULT_PRESIGN_TTL_SECONDS,
    maxPresignTtl: row?.maxPresignTtl ?? MAX_PRESIGN_TTL_SECONDS,
    hostingCacheMaxAge: row?.hostingCacheMaxAge ?? HOSTING_CACHE_MAX_AGE,
    activityRetentionDays:
      row?.activityRetentionDays ?? ACTIVITY_RETENTION_DAYS,
    apiRequestRetentionDays:
      row?.apiRequestRetentionDays ?? API_REQUEST_RETENTION_DAYS,
  };
}

function saveSettings(values: Partial<typeof settings.$inferInsert>) {
  db.insert(settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .run();
}

export function setDefaultVisibility(visibility: Visibility) {
  saveSettings({ defaultVisibility: visibility });
}

export function setLimits(limits: Limits) {
  saveSettings(limits);
}
