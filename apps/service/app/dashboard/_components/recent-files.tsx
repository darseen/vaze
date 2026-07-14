import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BASE_DATA_PATH } from "@/constants";
import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import { formatBytes, parseTimestamp } from "@/utils";
import { desc } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import {
  File,
  FileArchive,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
} from "lucide-react";

function getDisplayPath(absolutePath: string, basePath: string) {
  const normalizedPath = absolutePath.replace(/\\/g, "/");
  const normalizedBase = basePath.replace(/\\/g, "/");

  if (normalizedPath.startsWith(normalizedBase)) {
    return normalizedPath.slice(normalizedBase.length).replace(/^\//, "");
  }

  return absolutePath;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const iconClass = "h-4 w-4 text-muted-foreground";

  switch (ext) {
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "svg":
      return <Image className={iconClass} />;
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "json":
    case "html":
    case "css":
      return <FileCode className={iconClass} />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <FileArchive className={iconClass} />;
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
      return <Music className={iconClass} />;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
      return <Video className={iconClass} />;
    case "txt":
    case "md":
    case "doc":
    case "docx":
    case "pdf":
      return <FileText className={iconClass} />;
    default:
      return <File className={iconClass} />;
  }
}

export default async function RecentFiles() {
  const files = db
    .select({
      id: filesTable.id,
      name: filesTable.name,
      size: filesTable.size,
      path: filesTable.path,
      createdAt: filesTable.createdAt,
    })
    .from(filesTable)
    .orderBy(desc(filesTable.createdAt))
    .limit(5)
    .all();

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base font-medium">Recent Files</CardTitle>
        <CardDescription>Latest uploaded files</CardDescription>
      </CardHeader>
      <CardContent
        className={`h-64 ${files.length === 0 ? "flex items-center justify-center" : "space-y-4"}`}
      >
        {files.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No files uploaded yet
          </p>
        ) : (
          files.map((file) => {
            const dateObj = parseTimestamp(file.createdAt);

            return (
              <div key={file.id} className="flex items-center gap-3">
                {getFileIcon(file.name)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {getDisplayPath(file.path, BASE_DATA_PATH)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">
                    {formatBytes(file.size)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDistanceToNow(dateObj, {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
