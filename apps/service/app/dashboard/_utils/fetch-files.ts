import type { File } from "@/db";
import { ApiResponse } from "@/types";
import { cookies } from "next/headers";

export default async function fetchFiles(): Promise<
  ApiResponse<{ files: File[] }>
> {
  try {
    const response = await fetch(`${process.env.BASE_URL}/api/files`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: (await cookies()).toString(),
      },
    });

    const result = (await response.json()) as ApiResponse<{ files: File[] }>;

    return result;
  } catch (error) {
    console.log("fetch files error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
