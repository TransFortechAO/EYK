"use client"

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/topbar";
import { AuthGate } from "@/components/auth-gate";

const ROTAS_PUBLICAS = new Set(["/login", "/register"]);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublica = ROTAS_PUBLICAS.has(pathname);

  if (isPublica) {
    // Rotas públicas (login, register) NÃO têm sidebar NÃO têm auth gate.
    return (
      <ThemeProvider>
        {children}
      </ThemeProvider>
    );
  }

  // Todas as outras rotas (internas):
  // 1. ThemeProvider (tema dark/gold)
  // 2. AuthGate (🔒 portão de auth → se não logado redireciona /login)
  // 3. SidebarProvider (sidebar esquerda + topbar + conteúdo)
  return (
    <ThemeProvider>
      <AuthGate>
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
      </AuthGate>
    </ThemeProvider>
  );
}
