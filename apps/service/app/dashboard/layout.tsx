import getUser from "@/actions/auth/get-user-from-token";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import AppSidebar from "./_components/app-sidebar";
import SiteHeader from "./_components/site-header";

export default async function DashboardLayout({
  children,
}: {
  children: Readonly<ReactNode>;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const { data } = await getUser();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar username={data?.username ?? null} />
      <SidebarInset className="h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
