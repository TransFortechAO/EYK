"use client"

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { AuthGate } from "@/components/auth-gate";
import { OfflineBanner } from "@/components/pwa";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { AvisoPlataforma } from "@/components/aviso-plataforma";
import { EscolaGlobal } from "@/components/instituicao/contexto";

const ROTAS_PUBLICAS = new Set([
  "/",
  "/login",
  "/register",
  "/recuperar-senha",
  "/recuperar-senha/confirmar",
  "/verificar-email",
  "/ser-professor",
  "/ser-professor/concluir",
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
  // 3. EscolaGlobal (escola atual e papel — menus e páginas, se a área Instituição estiver ativa)
  // 4. SidebarProvider (sidebar esquerda + topbar + conteúdo)
  return (
    <ThemeProvider>
      <AuthGate>
        <EscolaGlobal>
          <SidebarProvider>
            <div className="flex min-h-dvh w-full">
              <AppSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <AvisoPlataforma />
                <OfflineBanner />
                <EmailVerificationBanner />
                <Topbar />
                <main className="flex-1 p-4 sm:p-6 md:p-8 max-lg:pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
                  <PageTransition routeKey={pathname}>
                    {children}
                  </PageTransition>
                </main>
                <BottomNav />
              </div>
            </div>
          </SidebarProvider>
        </EscolaGlobal>
      </AuthGate>
    </ThemeProvider>
  );
}
