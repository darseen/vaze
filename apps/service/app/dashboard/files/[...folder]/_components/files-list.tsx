"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { File, Folder } from "@/db";
import { ArrowLeft, FileIcon, FolderIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import FileCard from "./file-card";
import FolderCard from "./folder-card";

interface Props {
  files: File[];
  folders: Folder[];
}

export default function FilesList({ files, folders }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <section className="space-y-4">
      <div className="space-y-4">
        {/* Back Button  */}
        {pathname !== "/dashboard/files/uploads" && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-muted/50 flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </div>
        )}

        {/* File/Folder Count Badges */}
        {(folders.length > 0 || files.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {folders.length > 0 && (
              <Badge
                variant="secondary"
                className="border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
              >
                <FolderIcon className="mr-1 h-3 w-3" />
                {folders.length === 1
                  ? "1 folder"
                  : `${folders.length} folders`}
              </Badge>
            )}

            {files.length > 0 && (
              <Badge
                variant="secondary"
                className="border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              >
                <FileIcon className="mr-1 h-3 w-3" />
                {files.length === 1 ? "1 file" : `${files.length} files`}
              </Badge>
            )}
          </div>
        )}
      </div>
      {files.length === 0 && folders.length === 0 ? (
        <div className="py-12 text-center">
          <FileIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No files found
          </h3>
          {/* <p className="text-muted-foreground">
          {searchTerm
            ? "Try adjusting your search terms"
            : "Upload your first file to get started"}
        </p> */}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}

          {files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </section>
  );
}
