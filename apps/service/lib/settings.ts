import { DEFAULT_FILE_VISIBILITY } from "@/constants";
import { db, SETTINGS_ID } from "@/db";
import { settings } from "@repo/db";
import type { Visibility } from "@repo/types";
import { eq, sql } from "drizzle-orm";

/** Visibility applied to an upload that does not ask for one. */
export function getDefaultVisibility(): Visibility {
  const row = db
    .select({ defaultVisibility: settings.defaultVisibility })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .get();

  return row?.defaultVisibility ?? DEFAULT_FILE_VISIBILITY;
}

export function setDefaultVisibility(visibility: Visibility) {
  db.insert(settings)
    .values({ id: SETTINGS_ID, defaultVisibility: visibility })
    .onConflictDoUpdate({
      target: settings.id,
      set: { defaultVisibility: visibility, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .run();
}
