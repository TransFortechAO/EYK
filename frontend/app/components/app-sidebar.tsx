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
  LayoutDashboard,
  Video,
} from "lucide-react";
import { useState } from "react";
import { api, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  { title: "Novidades", url: "/notificacoes", icon: Bell },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Gamificação", url: "/gamificacao", icon: TrendingUp },
  { title: "Biblioteca LGA", url: "/biblioteca", icon: Hand },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const administracao = [
  { title: "Professores", url: "/configuracoes/administracao/professores", icon: GraduationCap },
  { title: "Utilizadores", url: "/configuracoes/administracao/utilizadores", icon: UserCog },
];

const professorNav = [
  { title: "Painel", url: "/professor", icon: LayoutDashboard },
  { title: "Meus Cursos", url: "/professor/cursos", icon: BookOpen },
  { title: "Meus Vídeos", url: "/professor/videos", icon: Video },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const pathname = usePathname();
  const { user } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const isActive = (url: string) =>
    url === "/inicio" ? pathname === "/inicio" : pathname === url || pathname.startsWith(url + "/");
  const closeOnNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

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
      <SidebarHeader className="px-4 py-5">
        <Link href="/inicio" className="flex items-center gap-2" onClick={closeOnNavigate}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-gold text-sidebar-primary-foreground font-serif text-lg font-bold shadow-gold">
            E
          </div>
          {!collapsed && (
            <span className="font-serif text-xl font-semibold tracking-tight text-sidebar-primary">
              EYK
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
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

        {user?.isTeacher && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled tooltip="Professor" className="opacity-60 cursor-default hover:bg-transparent">
                      <LayoutDashboard />
                      <span>Professor</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
          </>
        )}

        {user?.isStaff && (
          <>
            <SidebarSeparator />
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
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Sair"
              disabled={logoutLoading}
              className="text-destructive hover:bg-sidebar-accent hover:text-destructive cursor-pointer"
            >
              <LogOut />
              <span>{logoutLoading ? "A sair…" : "Sair"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}