import { toStoragePath } from "@/app/api/_utils";
import { db } from "@/db";
import { streamFileResponse } from "@/lib/http-cache";
import { getThumbnail } from "@/lib/thumbnails";
import { getPreviewKind } from "@/utils/file-type";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import authorizeRequest from "../../../_utils/authorize-request";

function notFound(message: string) {
  return NextResponse.json({ data: null, error: { message } }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // a folder of images asks for one per card, faster than the API's allowance
    const { error: authError } = await authorizeRequest(request, {
      bucket: "thumbnails",
      limit: 1200,
    });
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    const { id } = await params;

    const file = db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, id))
      .get();
    if (!file) return notFound("File not found");

    if (getPreviewKind(file.name, file.mimeType) !== "image") {
      return notFound("No thumbnail for this file");
    }

    const thumbnail = await getThumbnail(file.id, toStoragePath(file.key));
    if (!thumbnail) return notFound("No thumbnail for this file");

    // a file's content never changes under its id, so neither does this
    return streamFileResponse({
      request,
      path: thumbnail.path,
      stats: thumbnail.stats,
      cacheable: true,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("error serving thumbnail:", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
