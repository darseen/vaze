import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getDefaultVisibility, getLimits } from "@/lib/settings";
import { files, sessions } from "@repo/db";
import type { Visibility } from "@repo/types";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";

export interface SessionSummary {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

export default async function fetchSettings() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) return { data: null, error: { message: "Unauthorized" } };

    // read directly: Better Auth's listSessions rejects sessions over a day old
    const activeSessions: SessionSummary[] = db
      .select({
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, session.user.id),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.updatedAt))
      .all()
      .map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        current: row.id === session.session.id,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current));

    const visibilityCounts: Record<Visibility, number> = {
      public: 0,
      private: 0,
    };
    const counted = db
      .select({ visibility: files.visibility, total: count() })
      .from(files)
      .groupBy(files.visibility)
      .all();
    for (const row of counted) visibilityCounts[row.visibility] = row.total;

    return {
      data: {
        profile: { name: session.user.name, email: session.user.email },
        sessions: activeSessions,
        defaultVisibility: getDefaultVisibility(),
        visibilityCounts,
        limits: getLimits(),
      },
      error: null,
    };
  } catch (error) {
    console.log("fetch settings error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
