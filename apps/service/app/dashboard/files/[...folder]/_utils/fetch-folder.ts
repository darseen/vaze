import { ApiResponse } from "@/types";
import type { File, Folder } from "@repo/types";
import { cookies } from "next/headers";

export default async function fetchFolder({
  id,
  path,
}: {
  id?: string;
  path?: string;
}): Promise<ApiResponse<{ files: File[]; folders: Folder[] }>> {
  const pathname = id
    ? `api/folders?id=${id}`
    : path
      ? `api/folders?path=${path}`
      : `api/folders`;

  try {
    const response = await fetch(`${process.env.BASE_URL}/${pathname}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: (await cookies()).toString(),
      },
    });

    const result = (await response.json()) as ApiResponse<{
      files: File[];
      folders: Folder[];
    }>;

    return result;
  } catch (error) {
    console.log("fetch files error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
