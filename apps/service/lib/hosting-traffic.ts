import { db } from "@/db";
import { files, hostingDays, hostingFileDays } from "@repo/db";
import { inArray, sql } from "drizzle-orm";

type DayTally = { requests: number; bytes: number; notFound: number };
type FileTally = {
  date: string;
  fileId: string;
  requests: number;
  bytes: number;
};

interface TrafficState {
  days: Map<string, DayTally>;
  files: Map<string, FileTally>;
  timer: ReturnType<typeof setInterval> | null;
}

const FLUSH_INTERVAL_MS = 60_000;
// stays well under SQLite's bound-parameter limit
const LOOKUP_BATCH = 500;

// Next can evaluate this module more than once per process, so the counters
// and the flush timer live on globalThis and are only set up once.
const globalForTraffic = globalThis as typeof globalThis & {
  __vazeHostingTraffic?: TrafficState;
};

const state = (globalForTraffic.__vazeHostingTraffic ??= {
  days: new Map(),
  files: new Map(),
  timer: null,
});

const utcDate = () => new Date().toISOString().slice(0, 10);

function dayTally(date: string): DayTally {
  let tally = state.days.get(date);
  if (!tally) {
    tally = { requests: 0, bytes: 0, notFound: 0 };
    state.days.set(date, tally);
  }
  return tally;
}

function fileTally(date: string, fileId: string): FileTally {
  const key = `${date}/${fileId}`;
  let tally = state.files.get(key);
  if (!tally) {
    tally = { date, fileId, requests: 0, bytes: 0 };
    state.files.set(key, tally);
  }
  return tally;
}

/** A response that served the file: 200, 206 or 304. */
export function countServed(fileId: string) {
  const date = utcDate();
  dayTally(date).requests += 1;
  fileTally(date, fileId).requests += 1;
}

/** Body bytes as they stream, so an aborted download only counts what left. */
export function countBytes(fileId: string, bytes: number) {
  const date = utcDate();
  dayTally(date).bytes += bytes;
  fileTally(date, fileId).bytes += bytes;
}

export function countNotFound() {
  dayTally(utcDate()).notFound += 1;
}

/** Add the counts gathered since the last flush to the daily rows. */
export function flushHostingTraffic() {
  if (state.days.size === 0 && state.files.size === 0) return;

  const days = state.days;
  const tallies = [...state.files.values()];
  state.days = new Map();
  state.files = new Map();

  try {
    db.transaction((tx) => {
      for (const [date, tally] of days) {
        tx.insert(hostingDays)
          .values({ date, ...tally })
          .onConflictDoUpdate({
            target: hostingDays.date,
            set: {
              requests: sql`${hostingDays.requests} + excluded.requests`,
              bytes: sql`${hostingDays.bytes} + excluded.bytes`,
              notFound: sql`${hostingDays.notFound} + excluded.not_found`,
            },
          })
          .run();
      }

      // a file deleted after it was served would fail the foreign key
      const ids = [...new Set(tallies.map((tally) => tally.fileId))];
      const existing = new Set<string>();
      for (let start = 0; start < ids.length; start += LOOKUP_BATCH) {
        const rows = tx
          .select({ id: files.id })
          .from(files)
          .where(inArray(files.id, ids.slice(start, start + LOOKUP_BATCH)))
          .all();
        for (const row of rows) existing.add(row.id);
      }

      for (const tally of tallies) {
        if (!existing.has(tally.fileId)) continue;

        tx.insert(hostingFileDays)
          .values(tally)
          .onConflictDoUpdate({
            target: [hostingFileDays.date, hostingFileDays.fileId],
            set: {
              requests: sql`${hostingFileDays.requests} + excluded.requests`,
              bytes: sql`${hostingFileDays.bytes} + excluded.bytes`,
            },
          })
          .run();
      }
    });
  } catch (error) {
    // best-effort like the API request log: losing a minute of counts must
    // never break serving files
    console.error("failed to save hosting traffic", error);
  }
}

if (!state.timer) {
  state.timer = setInterval(flushHostingTraffic, FLUSH_INTERVAL_MS);
  state.timer.unref();
  // better-sqlite3 writes synchronously, so this still lands while exiting
  process.once("exit", flushHostingTraffic);
}
