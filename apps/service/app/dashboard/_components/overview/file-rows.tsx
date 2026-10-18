import { cn } from "@/lib/utils";
import { getFileCategory } from "@/utils/file-type";
import type { FileWithUrl } from "@repo/types";
import Link from "next/link";
import { CATEGORY_ICONS, fileHref } from "./helpers";
import { ShareBar } from "./panel";

export interface FileRow {
  file: FileWithUrl;
  /** Second line under the name; ignored when `share` is set. */
  meta?: string;
  /** Draws a bar under the name instead of `meta`. */
  share?: number;
  aside: string;
  asideDetail?: string;
}

export default function FileRows({ rows }: { rows: FileRow[] }) {
  return (
    <ul className="-mx-2 space-y-1">
      {rows.map(({ file, meta, share, aside, asideDetail }) => {
        const Icon = CATEGORY_ICONS[getFileCategory(file.name)];

        return (
          <li key={file.id}>
            <Link
              href={fileHref(file)}
              className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
            >
              <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <Icon className="text-muted-foreground size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                {share !== undefined ? (
                  <ShareBar share={share} />
                ) : (
                  meta && (
                    <p className="text-muted-foreground truncate text-xs">
                      {meta}
                    </p>
                  )
                )}
              </div>
              {/* a fixed width lines the bars up when they are shown */}
              <div
                className={cn(
                  "shrink-0 text-right",
                  share !== undefined && "w-20",
                )}
              >
                <p className="text-muted-foreground text-sm">{aside}</p>
                {asideDetail && (
                  <p className="text-muted-foreground text-xs">{asideDetail}</p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
