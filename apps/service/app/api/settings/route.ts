import { parseVisibility } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { fail } from "@/app/api/_utils/responses";
import { pruneHistory } from "@/db";
import {
  getInstanceSettings,
  getLimits,
  setDefaultVisibility,
  setLimits,
} from "@/lib/settings";
import type { Limits } from "@repo/types";
import { NextRequest, NextResponse } from "next/server";

// smallest accepted value for each limit
const MINIMUMS: Record<keyof Limits, number> = {
  maxUploadSize: 1,
  defaultPresignTtl: 1,
  maxPresignTtl: 1,
  hostingCacheMaxAge: 0,
  activityRetentionDays: 1,
  apiRequestRetentionDays: 1,
};

const LABELS: Record<keyof Limits, string> = {
  maxUploadSize: "Maximum upload size",
  defaultPresignTtl: "Default signed link lifetime",
  maxPresignTtl: "Maximum signed link lifetime",
  hostingCacheMaxAge: "Public cache lifetime",
  activityRetentionDays: "Activity history retention",
  apiRequestRetentionDays: "API request log retention",
};

// API keys never carry this scope, so only a signed-in admin gets through
async function authorize(request: NextRequest) {
  return await authorizeRequest(request, {
    scope: "settings:manage",
    session: true,
  });
}

/** Fills the limits left out from the saved ones, or names the first bad one. */
function parseLimits(
  input: unknown,
): { limits: Limits; error: null } | { limits: null; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { limits: null, error: "limits must be an object" };
  }

  const limits = { ...getLimits(), ...input } as Record<keyof Limits, unknown>;

  for (const key of Object.keys(MINIMUMS) as (keyof Limits)[]) {
    const value = limits[key];

    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < MINIMUMS[key]
    ) {
      return {
        limits: null,
        error: `${LABELS[key]} must be a whole number of at least ${MINIMUMS[key]}`,
      };
    }
  }

  const parsed = Object.fromEntries(
    (Object.keys(MINIMUMS) as (keyof Limits)[]).map((key) => [
      key,
      limits[key],
    ]),
  ) as Limits;

  if (parsed.defaultPresignTtl > parsed.maxPresignTtl) {
    return {
      limits: null,
      error:
        "The default signed link lifetime can't be longer than the maximum",
    };
  }

  return { limits: parsed, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({ data: getInstanceSettings(), error: null });
  } catch (error) {
    console.error("get settings error", error);
    return fail("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: { defaultVisibility?: unknown; limits?: unknown } =
      await request.json();

    if (body.defaultVisibility === undefined && body.limits === undefined) {
      return fail("Send defaultVisibility or limits", 400);
    }

    const visibility =
      body.defaultVisibility === undefined
        ? null
        : parseVisibility(body.defaultVisibility);

    if (body.defaultVisibility !== undefined && !visibility) {
      return fail("Invalid visibility", 400);
    }

    const parsed = body.limits === undefined ? null : parseLimits(body.limits);
    if (parsed?.error) return fail(parsed.error, 400);

    if (visibility) setDefaultVisibility(visibility);

    if (parsed?.limits) {
      setLimits(parsed.limits);
      // apply a shorter retention right away instead of at the next daily prune
      pruneHistory();
    }

    return NextResponse.json({ data: getInstanceSettings(), error: null });
  } catch (error) {
    console.error("update settings error", error);
    return fail("Internal server error", 500);
  }
}
