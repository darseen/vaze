import authorizeRequest from "@/app/api/_utils/authorize-request";
import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { normalizeKeyScopes, SCOPE_INFO } from "@/lib/permissions";
import { apiKeys } from "@repo/db";
import { createApiKey, listApiKeys } from "@/utils/api-keys";
import { and, eq, ne, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function fail(message: string, status: number) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

// keys never carry this scope, so only a signed-in session gets through
async function authorize(request: NextRequest) {
  return await authorizeRequest(request, { scope: "api-keys:manage" });
}

function parseName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nameTaken(userId: string, name: string, exceptId?: string) {
  const conditions = [eq(apiKeys.userId, userId), eq(apiKeys.name, name)];
  if (exceptId) conditions.push(ne(apiKeys.id, exceptId));

  return Boolean(
    db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(...conditions))
      .get(),
  );
}

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({
      data: { keys: listApiKeys(authData.user.id) },
      error: null,
    });
  } catch (error) {
    console.error("list api keys error", error);
    return fail("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: { name?: unknown; scopes?: unknown; expiresAt?: unknown } =
      await request.json();
    const name = parseName(body.name);
    const scopes = normalizeKeyScopes(body.scopes);

    if (!name) return fail("Missing key name", 400);
    if (scopes.length === 0) return fail("Pick at least one scope", 400);

    if (scopes.some((scope) => !authData.scopes.includes(scope))) {
      return fail("You can't give a key a scope you don't have", 403);
    }

    let expiresAt: Date | null = null;
    if (body.expiresAt !== undefined && body.expiresAt !== null) {
      expiresAt =
        typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;

      if (!expiresAt || !(expiresAt.getTime() > Date.now())) {
        return fail("expiresAt must be a date in the future", 400);
      }
    }

    if (nameTaken(authData.user.id, name)) {
      return fail("Key name already exists", 409);
    }

    const key = createApiKey(authData.user.id, name, expiresAt, scopes);

    const access = scopes.map((scope) => SCOPE_INFO[scope].label).join(", ");
    const expiry = expiresAt
      ? `Expires ${expiresAt.toISOString().slice(0, 10)}`
      : "Never expires";

    recordActivity({
      userId: authData.user.id,
      type: "api-key.created",
      target: name,
      detail: `${access} · ${expiry}`,
    });

    return NextResponse.json({ data: { key }, error: null });
  } catch (error) {
    console.error("create api key error", error);
    return fail("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: { id?: unknown; name?: unknown } = await request.json();
    const name = parseName(body.name);

    if (typeof body.id !== "string" || !name) {
      return fail("Missing id or name", 400);
    }

    const owned = and(
      eq(apiKeys.id, body.id),
      eq(apiKeys.userId, authData.user.id),
    );
    const previous = db
      .select({ name: apiKeys.name })
      .from(apiKeys)
      .where(owned)
      .get();

    if (!previous) return fail("Key not found", 404);
    if (previous.name === name)
      return NextResponse.json({ data: null, error: null });

    if (nameTaken(authData.user.id, name, body.id)) {
      return fail("Key name already exists", 409);
    }

    db.update(apiKeys)
      .set({ name, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(owned)
      .run();

    recordActivity({
      userId: authData.user.id,
      type: "api-key.renamed",
      target: name,
      detail: `Renamed from "${previous.name}"`,
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("rename api key error", error);
    return fail("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: { id?: unknown } = await request.json();
    if (typeof body.id !== "string") return fail("Missing id", 400);

    const deleted = db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, body.id), eq(apiKeys.userId, authData.user.id)))
      .returning({ name: apiKeys.name })
      .all();

    if (deleted.length === 0) return fail("Key not found", 404);

    recordActivity({
      userId: authData.user.id,
      type: "api-key.deleted",
      target: deleted[0].name,
      detail: "Access revoked for anything using this key",
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("delete api key error", error);
    return fail("Internal server error", 500);
  }
}
