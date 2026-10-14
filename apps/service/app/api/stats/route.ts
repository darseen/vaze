import { getFilesWithUrls } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { BASE_DATA_PATH } from "@/constants";
import { db } from "@/db";
import { apiKeys, apiRequests, files, folders } from "@repo/db";
import type { Stats } from "@repo/types";
import { getAvailableStorage } from "@/utils/storage";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;

async function fileStats(): Promise<NonNullable<Stats["files"]>> {
  const usage = db
    .select({ total: count(), used: sql<number | null>`sum(${files.size})` })
    .from(files)
    .get();

  const [{ value: folderCount }] = db
    .select({ value: count() })
    .from(folders)
    .all();

  const typeSize = sql<number>`sum(${files.size})`;
  const types = db
    .select({ mimeType: files.mimeType, size: typeSize, count: count() })
    .from(files)
    .groupBy(files.mimeType)
    .orderBy(desc(typeSize))
    .all();

  const largest = db
    .select()
    .from(files)
    .orderBy(desc(files.size))
    .limit(5)
    .all();

  const recent = db
    .select()
    .from(files)
    .orderBy(desc(files.createdAt))
    .limit(5)
    .all();

  return {
    total: usage?.total ?? 0,
    folders: folderCount,
    storage: {
      used: usage?.used ?? 0,
      available: await getAvailableStorage(BASE_DATA_PATH),
    },
    types,
    largest: getFilesWithUrls(largest),
    recent: getFilesWithUrls(recent),
  };
}

function apiKeyStats(userId: string): NonNullable<Stats["apiKeys"]> {
  const [{ value: total }] = db
    .select({ value: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();

  const day = sql<string>`date(${apiRequests.createdAt})`;
  const rows = db
    .select({ day, value: count() })
    .from(apiRequests)
    .where(
      and(
        eq(apiRequests.userId, userId),
        gte(apiRequests.createdAt, sql`date('now', '-6 days')`),
      ),
    )
    .groupBy(day)
    .all();

  const counts = new Map(rows.map((row) => [row.day, row.value]));
  const requests = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * DAY_MS)
      .toISOString()
      .slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });

  return { total, requests };
}

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      {},
    );
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    const { user, scopes } = authData;

    const data: Stats = {
      files: scopes.includes("files:read") ? await fileStats() : null,
      apiKeys: scopes.includes("api-keys:manage") ? apiKeyStats(user.id) : null,
    };

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("get stats error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
