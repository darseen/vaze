"use client";

import logo from "@/assets/images/vaze.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavUser from "./nav-user";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        isActive: (pathname) => pathname === "/dashboard",
      },
      {
        title: "Files",
        href: "/dashboard/files/uploads",
        icon: FolderOpen,
        isActive: (pathname) => pathname.startsWith("/dashboard/files"),
      },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        title: "API Keys",
        href: "/dashboard/api-keys",
        icon: KeyRound,
        isActive: (pathname) => pathname.startsWith("/dashboard/api-keys"),
      },
    ],
  },
];

const activeStyles = [
  "relative transition-colors",
  "data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border",
  "data-[active=true]:before:absolute data-[active=true]:before:top-1/2 data-[active=true]:before:left-0 data-[active=true]:before:h-4 data-[active=true]:before:w-0.5 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary",
  "group-data-[collapsible=icon]:before:hidden",
].join(" ");

export default function AppSidebar({ username }: { username: string | null }) {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-sidebar-accent/60"
            >
              <Link href="/dashboard">
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-200/80 to-amber-500/40 ring-1 ring-amber-500/25 dark:from-amber-400/20 dark:to-amber-700/20">
                  <Image src={logo} alt="" className="size-5 object-contain" />
                </span>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold tracking-tight">
                    Vaze
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    File hosting &amp; storage
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground/70 text-[11px] font-medium tracking-wider uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={item.isActive(pathname)}
                      className={activeStyles}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser username={username} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
