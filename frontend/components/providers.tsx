"use client"

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/topbar";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <ThemeProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 p-6 md:p-8">
              <PageTransition routeKey={pathname}>
                {children}
              </PageTransition>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}