"use client";

import logo from "@/assets/images/vaze.png";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Scope } from "@repo/types";
import {
  ArchiveRestore,
  ChevronRight,
  FolderOpen,
  History,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import NavUser from "./nav-user";
import { useCan } from "./permissions";
import type { ToolSection } from "@/lib/tool-sections";
import { TOOL_GROUPS, toolHref, type ToolGroup } from "./tools";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
  scope?: Scope;
  /** Makes the item a group that opens to list these tools. */
  group?: ToolGroup;
  /** The section the server can turn off. */
  section?: ToolSection;
};

const groupItem = (section: ToolSection): NavItem => {
  const group: ToolGroup = TOOL_GROUPS[section];
  return {
    title: group.title,
    href: group.href,
    icon: group.icon,
    isActive: (pathname) =>
      pathname === group.href || pathname.startsWith(`${group.href}/`),
    scope: group.scope,
    group,
    section,
  };
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Manage",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        isActive: (pathname) => pathname === "/dashboard",
      },
      {
        title: "Files",
        href: "/dashboard/files",
        icon: FolderOpen,
        isActive: (pathname) => pathname.startsWith("/dashboard/files"),
        scope: "files:read",
      },
      {
        title: "Recently deleted",
        href: "/dashboard/deleted",
        icon: ArchiveRestore,
        isActive: (pathname) => pathname.startsWith("/dashboard/deleted"),
        scope: "files:read",
      },
      {
        title: "API Keys",
        href: "/dashboard/api-keys",
        icon: KeyRound,
        isActive: (pathname) => pathname.startsWith("/dashboard/api-keys"),
        scope: "api-keys:manage",
      },
      {
        title: "Activity",
        href: "/dashboard/activity",
        icon: History,
        isActive: (pathname) => pathname.startsWith("/dashboard/activity"),
      },
      {
        title: "Users",
        href: "/dashboard/users",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/dashboard/users"),
        scope: "users:manage",
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        isActive: (pathname) => pathname.startsWith("/dashboard/settings"),
      },
    ],
  },
  {
    label: "Tools",
    items: [groupItem("conversion"), groupItem("pdf")],
  },
];

const activeStyles = [
  "relative transition-colors",
  "data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border",
  "data-[active=true]:before:absolute data-[active=true]:before:top-1/2 data-[active=true]:before:left-0 data-[active=true]:before:h-4 data-[active=true]:before:w-0.5 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary",
  "group-data-[collapsible=icon]:before:hidden",
].join(" ");

/** A group of tools, open as a list in the sidebar, or beside its icon when the sidebar is folded. */
function ToolGroupItem({
  item,
  group,
  pathname,
}: {
  item: NavItem;
  group: ToolGroup;
  pathname: string;
}) {
  const { state, isMobile } = useSidebar();
  const active = item.isActive(pathname);
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);

  // arriving on one of its tools opens the group
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={active} className={activeStyles}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {group.tools.map((tool) => (
              <DropdownMenuItem key={tool.slug} asChild>
                <Link href={toolHref(group, tool)}>
                  <tool.icon />
                  {tool.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        {/* the open list shows which tool is current, so only a closed group is marked */}
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={active && !open}
            className={activeStyles}
          >
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.tools.map((tool) => {
              const href = toolHref(group, tool);
              return (
                <SidebarMenuSubItem key={tool.slug}>
                  <SidebarMenuSubButton asChild isActive={pathname === href}>
                    <Link href={href}>
                      <span>{tool.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export default function AppSidebar({
  username,
  role,
  sections,
}: {
  username: string | null;
  role: string | null;
  /** Which tool sections the server has on. */
  sections: Record<ToolSection, boolean>;
}) {
  const pathname = usePathname();
  const can = useCan();

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
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-200/80 to-amber-500/40 ring-1 ring-amber-500/25 dark:from-amber-400/20 dark:to-amber-700/20">
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
        {navGroups.map((group) => {
          const items = group.items.filter(
            (item) =>
              (!item.scope || can(item.scope)) &&
              (!item.section || sections[item.section]),
          );
          // a label over nothing would be noise
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-muted-foreground/70 text-[11px] font-medium tracking-wider uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) =>
                    item.group ? (
                      <ToolGroupItem
                        key={item.href}
                        item={item}
                        group={item.group}
                        pathname={pathname}
                      />
                    ) : (
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
                    ),
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <NavUser username={username} role={role} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
