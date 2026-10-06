"use server";

import { pruneHistory } from "@/db";
import { setLimits, type Limits } from "@/lib/settings";
import auth from "@/utils/auth";
import { revalidatePath } from "next/cache";

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

export default async function updateLimits(input: Limits) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  const limits = {} as Limits;

  for (const key of Object.keys(MINIMUMS) as (keyof Limits)[]) {
    const value = input?.[key];

    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < MINIMUMS[key]
    ) {
      return {
        error: {
          message: `${LABELS[key]} must be a whole number of at least ${MINIMUMS[key]}`,
        },
        data: null,
      };
    }

    limits[key] = value;
  }

  if (limits.defaultPresignTtl > limits.maxPresignTtl) {
    return {
      error: {
        message:
          "The default signed link lifetime can't be longer than the maximum",
      },
      data: null,
    };
  }

  try {
    setLimits(limits);
    // apply a shorter retention right away instead of at the next daily prune
    pruneHistory();

    revalidatePath("/dashboard", "layout");
    return { error: null, data: { limits } };
  } catch (error) {
    console.log("update limits error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
