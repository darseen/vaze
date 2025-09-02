"use server";

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export default async function getUser() {
  try {
    const token = (await cookies()).get("token")?.value;
    if (!token)
      return { data: null, error: { message: "Unauthorized" }, status: 401 };

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const jwt = await jwtVerify(token, secret);

    return {
      data: { username: jwt.payload.username as string },
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
