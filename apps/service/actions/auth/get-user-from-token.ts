"use server";

import { verifyToken } from "@/utils/jwt";
import { cookies } from "next/headers";

export default async function getUserFromToken() {
  try {
    const cookiesStore = await cookies();
    const token = cookiesStore.get("token")?.value;
    if (!token)
      return { data: null, error: { message: "Unauthorized" }, status: 401 };

    const payload = await verifyToken(token);

    if (!payload) {
      cookiesStore.delete("token");
      return { data: null, error: { message: "Unauthorized" }, status: 401 };
    }

    return {
      data: { username: payload.user.username as string },
      error: null,
      status: 200,
    };
  } catch {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
