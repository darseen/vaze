import { db } from "@/db";
import { sessions } from "@repo/db";
import type { SessionSummary } from "@repo/types";
import { and, desc, eq, gt } from "drizzle-orm";

/** A user's live sessions, the current one first, then most recently used. */
export function listSessions(
  userId: string,
  currentId: string | null,
): SessionSummary[] {
  // read directly: Better Auth's listSessions rejects sessions over a day old
  return db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt))
    .all()
    .map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      current: row.id === currentId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}
