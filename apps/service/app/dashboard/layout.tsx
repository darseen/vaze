import getUser from "@/actions/auth/get-user-from-token";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import AppSidebar from "./_components/app-sidebar";
import SiteHeader from "./_components/site-header";
import UploadsPanel from "./_components/uploads/panel";
import UploadsProvider from "./_components/uploads/provider";

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
        {/* the provider sits above the pages so uploads survive navigation */}
        <UploadsProvider>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
          <UploadsPanel />
        </UploadsProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
