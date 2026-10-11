"use server";

import { recordActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { authorize } from "@/utils/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  actionError,
  describeAccess,
  parseAccess,
  type AccessInput,
} from "./_utils";

export default async function createUser(
  input: AccessInput & { name: string; email: string; password: string },
) {
  const { user, error } = await authorize("users:manage");

  if (error) return { error, data: null };

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email =
    typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!name || !email || !password) {
    return {
      error: { message: "Name, email and password are required" },
      data: null,
    };
  }

  // the admin endpoint skips the length check sign-up applies
  const { minPasswordLength, maxPasswordLength } = (await auth.$context)
    .password.config;

  if (
    password.length < minPasswordLength ||
    password.length > maxPasswordLength
  ) {
    return {
      error: {
        message: `Password must be ${minPasswordLength} to ${maxPasswordLength} characters`,
      },
      data: null,
    };
  }

  const access = parseAccess(input);

  if (access.error !== null) {
    return { error: { message: access.error }, data: null };
  }

  try {
    const { user: created } = await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: access.role,
        data: { scopes: access.scopes },
      },
      headers: await headers(),
    });

    recordActivity({
      userId: user.id,
      type: "user.created",
      target: name,
      detail: `${email} · ${describeAccess(access.role, access.scopes)}`,
    });

    revalidatePath("/dashboard/users");
    return { error: null, data: { id: created.id } };
  } catch (error) {
    return actionError(error, "Couldn't add user");
  }
}
