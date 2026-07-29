"use client";

import ThemeToggle from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

type Crumb = { label: string; href?: string };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1);

  if (segments.length === 0) return [{ label: "Dashboard" }];

  if (segments[0] === "api-keys") {
    return [{ label: "Dashboard", href: "/dashboard" }, { label: "API Keys" }];
  }

  if (segments[0] === "files") {
    const root = "/dashboard/files/uploads";
    // The first segment after "files" is the fixed "uploads" root.
    const folders = segments.slice(2).map(decodeURIComponent);

    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Files", href: folders.length ? root : undefined },
      ...folders.map((folder, index) => ({
        label: folder,
        href:
          index === folders.length - 1
            ? undefined
            : `${root}/${segments.slice(2, index + 3).join("/")}`,
      })),
    ];
  }

  return [{ label: "Dashboard" }];
}

export default function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="bg-background z-10 flex h-14 shrink-0 items-center gap-2 border-b md:rounded-t-xl">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
                <BreadcrumbItem
                  className={
                    index < crumbs.length - 1 ? "hidden md:block" : undefined
                  }
                >
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="max-w-40 truncate md:max-w-xs">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
