"use client"

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/topbar";
import { AuthGate } from "@/components/auth-gate";
import { OfflineBanner } from "@/components/pwa";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { AvisoPlataforma } from "@/components/aviso-plataforma";

const ROTAS_PUBLICAS = new Set([
  "/",
  "/login",
  "/register",
  "/recuperar-senha",
  "/recuperar-senha/confirmar",
  "/verificar-email",
  "/contestar",
  "/termos",
  "/privacidade",
]);
// Prefixos públicos (rotas dinâmicas), ex: verificação de um certificado.
const PREFIXOS_PUBLICOS = ["/certificados/"];
// Autenticadas, mas sem sidebar/topbar (ex: onboarding a meio do fluxo).
const ROTAS_SEM_CHROME = new Set(["/personalizar-perfil", "/definir-senha"]);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublica = ROTAS_PUBLICAS.has(pathname) || PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p));
  const isSemChrome = ROTAS_SEM_CHROME.has(pathname);

  if (isPublica) {
    // Rotas públicas (landing, login, register) NÃO têm sidebar NÃO têm auth gate.
    return (
      <ThemeProvider>
        <AvisoPlataforma />
        {children}
      </ThemeProvider>
    );
  }

  if (isSemChrome) {
    // Exige sessão (AuthGate), mas sem sidebar/topbar à volta.
    return (
      <ThemeProvider>
        <AuthGate>{children}</AuthGate>
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
              <AvisoPlataforma />
              <OfflineBanner />
              <EmailVerificationBanner />
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
