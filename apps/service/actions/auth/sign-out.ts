"use server";

import { cookies } from "next/headers";

export default async function signOut() {
  (await cookies()).delete("token");
  return { data: {}, error: null, status: 200 };
}
