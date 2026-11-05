"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  PlayCircle,
  Users,
  Bell,
  Trophy,
  Settings,
  LogOut,
  Hand,
  TrendingUp,
  ShieldCheck,
  GraduationCap,
  UserCog,
  BarChart3,
  LayoutDashboard,
  Video,
  ShieldAlert,
  SlidersHorizontal,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { abasTelemovel, restoParaMais, type ItemNav } from "@/lib/instituicoes/navegacao";
import { useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { ICONE_NAV } from "@/components/instituicao/icones-nav";
import { UserAvatar } from "@/components/UserAvatar";

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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Início", url: "/inicio", icon: Home },
  { title: "Cursos", url: "/cursos", icon: BookOpen },
  { title: "Vídeos", url: "/videos", icon: PlayCircle },
  { title: "Comunidade", url: "/comunidade", icon: Users },
];

const secondary = [
  { title: "Notificações", url: "/notificacoes", icon: Bell },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Gamificação", url: "/gamificacao", icon: TrendingUp },
  { title: "Biblioteca LGA", url: "/biblioteca", icon: Hand },
];

const administracao = [
  { title: "Métricas", url: "/configuracoes/administracao/metricas", icon: BarChart3 },
  ...(INSTITUICOES_ATIVAS ? [{ title: "Escolas e instituições", url: "/configuracoes/administracao/instituicoes", icon: Building2 }] : []),
  { title: "Moderação", url: "/configuracoes/administracao/moderacao", icon: ShieldAlert },
  { title: "Plataforma", url: "/configuracoes/administracao/plataforma", icon: SlidersHorizontal },
  { title: "Professores", url: "/configuracoes/administracao/professores", icon: GraduationCap },
  { title: "Utilizadores", url: "/configuracoes/administracao/utilizadores", icon: UserCog },
];

/**
 * Um grupo da navegação por papel (lib/instituicoes/navegacao.ts), com os
 * números do que há por ver. Usado no topo da barra (as mesmas entradas das
 * abas do telemóvel), em "A minha escola" e em "Plataforma EYK".
 */
function GrupoNav({
  titulo,
  itens,
  isActive,
  pathname,
  aoNavegar,
  separador = true,
}: {
  titulo?: string;
  itens: ItemNav[];
  isActive: (url: string) => boolean;
  pathname: string;
  aoNavegar: () => void;
  separador?: boolean;
}) {
  if (itens.length === 0) return null;
  // O painel (/instituicao) só fica ativo na própria página, não nas subpáginas que têm entrada própria.
  const ativo = (url: string) => (url === "/instituicao" ? pathname === "/instituicao" : isActive(url));

  return (
    <>
      {separador && <SidebarSeparator />}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {titulo && (
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip={titulo} className="opacity-60 cursor-default hover:bg-transparent">
                  <Building2 />
                  <span className="truncate">{titulo}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {itens.map((item) => {
              const Icone = ICONE_NAV[item.icone];
              return (
                <SidebarMenuItem key={`${item.id}-${item.url}`}>
                  <SidebarMenuButton
                    asChild
                    isActive={ativo(item.url)}
                    tooltip={item.contador ? `${item.titulo} (${item.contador})` : item.titulo}
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                  >
                    <Link href={item.url} onClick={aoNavegar}>
                      <span className="relative grid shrink-0 place-items-center">
                        <Icone className="size-[1.375rem]" />
                        {!!item.contador && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" aria-hidden />}
                      </span>
                      <span className="flex-1 truncate">{item.titulo}</span>
                      {!!item.contador && (
                        <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold tabular-nums text-primary" aria-label={`${item.contador} por ver`}>
                          {item.contador}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

const professorNav = [
  { title: "Painel", url: "/professor", icon: LayoutDashboard },
  { title: "Meus Cursos", url: "/professor/cursos", icon: BookOpen },
  { title: "Meus Vídeos", url: "/professor/videos", icon: Video },
];

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { user } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const isActive = (url: string) =>
    url === "/inicio" ? pathname === "/inicio" : pathname === url || pathname.startsWith(url + "/");
  const closeOnNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Navegação por papel (escola parceira): igual no computador, tablet e telemóvel.
  const escola = useInstituicaoOpcional();
  const papel = escola && !escola.aCarregar ? escola.atual?.membro.papel ?? null : null;
  const contadores = escola?.contadores ?? { porRever: 0, trabalhos: 0, avisosPorLer: 0 };
  const principais = papel ? abasTelemovel(papel, contadores) : null;
  const resto = papel ? restoParaMais(papel, contadores) : null;

  const handleLogout = async () => {
    if (logoutLoading) return;
    try {
      setLogoutLoading(true);
      await api.logout();
    } catch (err) {
      console.warn("logout warning:", err);
    } finally {
      setLogoutLoading(false);
      // Volta para a landing page pública do Django (porta 8000)
      window.location.assign(API_BASE_URL + "/");
    }
  };

  return (
    <Sidebar variant="floating" collapsible="icon">
      {/* O logótipo fica sempre no mesmo sítio, com o centro alinhado com os ícones. */}
      <SidebarHeader className="h-24 shrink-0 justify-center pl-[11px]">
        <LogoBarra aoNavegar={closeOnNavigate} />
      </SidebarHeader>

      <SidebarContent>
        {/* Equipa EYK: a administração vem primeiro. */}
        {user?.isStaff && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled tooltip="Administração" className="opacity-60 cursor-default hover:bg-transparent">
                      <ShieldCheck />
                      <span>Administração</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {administracao.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                      >
                        <Link href={item.url} onClick={closeOnNavigate}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}

        {/* Professor: as suas ferramentas primeiro, para saber logo que entrou como professor. */}
        {user?.isTeacher && (
          <SidebarGroup>
            <SidebarGroupLabel>Professor</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {professorNav.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                    >
                      <Link href={item.url} onClick={closeOnNavigate}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {user?.isTeacher && <SidebarSeparator />}

        {principais ? (
          // Com escola: as mesmas entradas principais das abas do telemóvel, por papel.
          <GrupoNav itens={principais} isActive={isActive} pathname={pathname} aoNavegar={closeOnNavigate} separador={false} />
        ) : (
          <SidebarGroup>
            {user?.isTeacher && <SidebarGroupLabel>Explorar</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {primary.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                    >
                      <Link href={item.url} onClick={closeOnNavigate}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {escola && !escola.aCarregar && (
          <GrupoNav
            titulo={escola.atual ? escola.atual.instituicao.nome : "Escola"}
            itens={resto ? resto.escola : [{ id: "entrar", titulo: "Entrar numa escola", url: "/instituicao/aderir", icone: "escola" }]}
            isActive={isActive}
            pathname={pathname}
            aoNavegar={closeOnNavigate}
          />
        )}
        {resto && resto.geral.length > 0 && (
          <GrupoNav titulo="Plataforma EYK" itens={resto.geral} isActive={isActive} pathname={pathname} aoNavegar={closeOnNavigate} />
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
                  >
                    <Link href={item.url} onClick={closeOnNavigate}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé: Configurações (penúltimo) e, por baixo, a conta com "Sair" à direita. */}
      <SidebarFooter className="gap-1 border-t border-sidebar-border px-4 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/configuracoes") && !pathname.startsWith("/configuracoes/administracao")}
              tooltip="Configurações"
              className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-medium"
            >
              <Link href="/configuracoes" onClick={closeOnNavigate}>
                <Settings />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <RodapeConta aoSair={handleLogout} aSair={logoutLoading} />
      </SidebarFooter>
    </Sidebar>
  );
}

/** Logótipo igual com a barra aberta ou recolhida, como no Instagram. */
function LogoBarra({ aoNavegar }: { aoNavegar: () => void }) {
  return (
    <Link href="/inicio" className="w-fit" onClick={aoNavegar} aria-label="EYK — Início">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png"
        alt="EYK"
        className="h-12 w-12 object-contain"
      />
    </Link>
  );
}

/** A conta: o ícone de perfil (leva ao perfil) e "Sair" encostado à direita. */
function RodapeConta({ aoSair, aSair }: { aoSair: () => void; aSair: boolean }) {
  const { state, isMobile } = useSidebar();
  const { user } = useAuth();
  const recolhida = !isMobile && state === "collapsed";
  return (
    // Altura fixa e ícone de perfil sempre no mesmo lugar. Recolhida, "Sair" fica no menu da barra do topo.
    <div className="flex h-12 items-center gap-2 pl-px">
      {user && (
        <Link href="/perfil" title="O meu perfil" aria-label="O meu perfil" className="shrink-0 rounded-full">
          <UserAvatar noLink name={user.name} initials={user.initials} foto={user.foto ?? null} userId={user.id} size={36} />
        </Link>
      )}
      {!recolhida && (
        <button
          type="button"
          onClick={aoSair}
          disabled={aSair}
          title="Sair"
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-sidebar-accent disabled:opacity-60"
        >
          <LogOut className="size-[1.375rem]" />
          {aSair ? "A sair…" : "Sair"}
        </button>
      )}
    </div>
  );
}
