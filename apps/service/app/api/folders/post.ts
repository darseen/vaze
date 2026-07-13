import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { folders as foldersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { accessPath, createNestedFolders } from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    const { folder }: { folder: string } = await request.json();

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Missing folder" } },
        { status: 400 },
      );
    }

    if (folder.includes(".")) {
      return NextResponse.json(
        { error: { message: "Folder name cannot contain dots" }, data: null },
        { status: 400 },
      );
    }

    const folderAbsolutePath = path.join(BASE_UPLOADS_PATH, folder);

    const fullPathExistsOnDisk = await accessPath(folderAbsolutePath);

    const fullPathExistsInDB = db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(eq(foldersTable.path, folderAbsolutePath))
      .get();

    if (fullPathExistsOnDisk || fullPathExistsInDB) {
      return NextResponse.json(
        { data: null, error: { message: "Folder already exists" } },
        { status: 409 },
      );
    }

    const newFolder = await createNestedFolders(folder);

    revalidatePath("/dashboard");
    return NextResponse.json({ data: { folder: newFolder }, error: null });
  } catch (error) {
    console.log("create folder error ", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
