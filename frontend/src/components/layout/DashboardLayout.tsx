import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { INFO } from "@/constants";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen">
        {/* Mobile-only floating trigger — always visible, opens sidebar Sheet */}
        <SidebarTrigger className="md:hidden fixed top-3 left-3 z-50 h-8 w-8 rounded-xl bg-sidebar/80 backdrop-blur border border-sidebar-border shadow-sm hover:bg-sidebar-accent" />
        <div className="flex-1 overflow-auto bg-background">
          <Outlet />
        </div>

        <footer className="border-t bg-muted/20 px-4 py-3 text-sm text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-center">
            <div className="rounded-full border px-6 py-1 text-center">{INFO.copyright}</div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
