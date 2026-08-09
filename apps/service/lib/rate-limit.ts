import { NextRequest } from "next/server";

interface Window {
  count: number;
  resetAt: number;
}

// Vaze runs as a single container, so an in-process counter is the whole story.
const windows = new Map<string, Window>();

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number;
}

/**
 * Fixed-window rate limit. `bucket` namespaces the counter so different routes
 * do not share an allowance.
 */
export function rateLimit(
  bucket: string,
  identifier: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const key = `${bucket}:${identifier}`;
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { ok: true, retryAfter: 0 };
}

/** Drop expired windows so the map cannot grow without bound. */
function sweep() {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

setInterval(sweep, 60_000).unref();
