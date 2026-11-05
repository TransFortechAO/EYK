"use client";

import { useCallback, useRef, useState } from "react";
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
 * primeiro item ("O meu perfil") leva à página privada do perfil (/perfil),
 * igual para alunos e professores. Abre ao passar o rato; no ecrã táctil
 * abre com um toque e, com o teclado, com Enter.
 */
export function ProfileMenu({ className }: { className?: string }) {
  const { user } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Só com rato. O atraso a fechar deixa levar o cursor do ícone até ao menu.
  const manterAberto = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (fecharRef.current) clearTimeout(fecharRef.current);
    setAberto(true);
  };
  const fecharDepois = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    fecharRef.current = setTimeout(() => setAberto(false), 200);
  };

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

  const perfilHref = "/perfil";
  const perfilLabel = "O meu perfil";

  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className={className ?? "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"}
          aria-label="Menu do utilizador"
          onPointerEnter={manterAberto}
          onPointerLeave={fecharDepois}
          // O menu já está aberto: um clique com o rato não o deve fechar.
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") e.preventDefault();
          }}
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
      <DropdownMenuContent
        align="end"
        className="w-56"
        onPointerEnter={manterAberto}
        onPointerLeave={fecharDepois}
      >
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
