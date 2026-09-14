"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { LogOut, User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-gate";
import { api, API_BASE_URL, mediaUrl } from "@/lib/api";

/**
 * Ícone de perfil partilhado por toda a plataforma. Abre um menu cujo
 * primeiro item ("Perfil" / "Perfil do Professor") leva sempre à página de
 * perfil correta consoante o papel de quem está autenticado — aluno vai
 * para /configuracoes (que abre já na aba "Perfil"), professor vai para
 * /professor/perfil.
 */
export function ProfileMenu({ className }: { className?: string }) {
  const { user } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = useCallback(async () => {
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
  }, [logoutLoading]);

  const name = user?.name?.trim() || "Utilizador";
  const initials =
    user?.initials?.trim() ||
    name
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    "?";

  const perfilHref = user?.isTeacher ? "/professor/perfil" : "/configuracoes";
  const perfilLabel = user?.isTeacher ? "Perfil do Professor" : "O meu perfil";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={className ?? "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"}
          aria-label="Menu do utilizador"
        >
          <Avatar className="h-9 w-9 border-2 border-primary/30">
            {user?.foto ? (
              <AvatarImage
                src={mediaUrl(user.foto) ?? undefined}
                alt={name}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="bg-gradient-gold text-primary-foreground font-semibold uppercase">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="inline-flex items-center gap-2">
            <User2 className="w-4 h-4 text-muted-foreground" />
            Olá, {name}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={perfilHref}>{perfilLabel}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/gamificacao">A minha gamificação</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">Configurações</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          disabled={logoutLoading}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {logoutLoading ? "A sair…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
