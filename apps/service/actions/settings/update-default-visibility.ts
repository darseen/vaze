"use server";

import { parseVisibility } from "@/app/api/_utils";
import { setDefaultVisibility } from "@/lib/settings";
import { authorize } from "@/utils/auth";
import { revalidatePath } from "next/cache";

export default async function updateDefaultVisibility(value: string) {
  const { error } = await authorize("settings:manage");

  if (error) return { error, data: null };

  const visibility = parseVisibility(value);

  if (!visibility) {
    return { error: { message: "Invalid visibility" }, data: null };
  }

  try {
    setDefaultVisibility(visibility);

    revalidatePath("/dashboard/settings");
    return { error: null, data: { visibility } };
  } catch (error) {
    console.log("update default visibility error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
