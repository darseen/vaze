import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils";
import { getFileCategory } from "@/utils/file-type";
import type { FileWithUrl } from "@repo/types";
import { Download, LoaderCircle } from "lucide-react";
import { CATEGORY_ICONS } from "../file-preview";

export function Loading({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex size-full items-center justify-center", className)}
    >
      <LoaderCircle className="text-muted-foreground size-8 animate-spin" />
    </div>
  );
}

export function NoPreview({
  file,
  message,
}: {
  file: FileWithUrl;
  message: string;
}) {
  const Icon = CATEGORY_ICONS[getFileCategory(file.name)];

  return (
    <div className="flex size-full flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="bg-muted flex size-24 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground size-12" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{message}</p>
        <p className="text-muted-foreground text-sm">
          {formatBytes(file.size)}
        </p>
      </div>
      <Button variant="secondary" asChild>
        <a href={`/api/files/download/${file.id}`} download>
          <Download />
          Download
        </a>
      </Button>
    </div>
  );
}
