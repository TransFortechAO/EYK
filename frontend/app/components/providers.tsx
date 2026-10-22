"use client"

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import { Topbar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
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
  const [montado, setMontado] = useState(false);
  const [caminhoInicial, setCaminhoInicial] = useState<string | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    setCaminhoInicial(window.location.pathname);
    setMontado(true);
  }, []);
  const caminho = pathname ?? caminhoInicial;

  // O servidor e o primeiro render do cliente mostram o mesmo placeholder.
  // Depois da hidratação, espera também pelo caminho antes de montar o AuthGate.
  if (!montado || caminho === null) {
    return (
      <ThemeProvider>
        <div className="fixed inset-0 bg-[#0a0a0a]" aria-busy="true" />
      </ThemeProvider>
    );
  }
  const isPublica = ROTAS_PUBLICAS.has(caminho) || PREFIXOS_PUBLICOS.some((p) => caminho.startsWith(p));
  const isSemChrome = ROTAS_SEM_CHROME.has(caminho);

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
          <div className="flex min-h-dvh w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <AvisoPlataforma />
              <OfflineBanner />
              <EmailVerificationBanner />
              <Topbar />
              <main className="flex-1 p-4 sm:p-6 md:p-8 max-lg:pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
                <PageTransition routeKey={caminho}>
                  {children}
                </PageTransition>
              </main>
              <BottomNav />
            </div>
          </div>
        </SidebarProvider>
      </AuthGate>
    </ThemeProvider>
  );
}
