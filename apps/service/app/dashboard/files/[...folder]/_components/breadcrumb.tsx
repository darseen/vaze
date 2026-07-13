"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import getFolderPath from "../_utils/get-folder-path";

const ROOT_HREF = "/dashboard/files/uploads";

export default function Breadcrumb() {
  const pathname = usePathname();

  // Path within the "uploads" root, e.g. "/photos/2024" -> ["photos", "2024"].
  const segments = getFolderPath(pathname)
    .split("/")
    .filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm"
    >
      <Link
        href={ROOT_HREF}
        className="hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <Home className="size-4" />
        <span>Home</span>
      </Link>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const href = `${ROOT_HREF}/${segments
          .slice(0, index + 1)
          .join("/")}`;
        const label = decodeURIComponent(segment);

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="size-4 shrink-0" />
            {isLast ? (
              <span className="text-foreground max-w-40 truncate font-medium">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="hover:text-foreground max-w-40 truncate transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
