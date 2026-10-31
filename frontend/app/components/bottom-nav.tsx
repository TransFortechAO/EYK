"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  Hand,
  Home,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  UserCog,
  Video,
  type LucideIcon,
} from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { abasTelemovel, restoParaMais, type ItemNav } from "@/lib/instituicoes/navegacao";
import { useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { ICONE_NAV } from "@/components/instituicao/icones-nav";

type Item = { title: string; url: string; icon: LucideIcon; contador?: number };

// As mesmas rotas da barra lateral (app-sidebar.tsx), repartidas entre as
// abas de baixo e o painel "Mais". As abas dependem do papel na escola
// (lib/instituicoes/navegacao.ts); sem escola: Início, Cursos, Vídeos, Comunidade.
function paraItem(i: ItemNav): Item {
  return { title: i.titulo, url: i.url, icon: ICONE_NAV[i.icone], contador: i.contador };
}

const MAIS: Item[] = [
  { title: "Notificações", url: "/notificacoes", icon: Bell },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Gamificação", url: "/gamificacao", icon: TrendingUp },
  { title: "Biblioteca LGA", url: "/biblioteca", icon: Hand },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const PROFESSOR: Item[] = [
  { title: "Painel", url: "/professor", icon: LayoutDashboard },
  { title: "Meus Cursos", url: "/professor/cursos", icon: BookOpen },
  { title: "Meus Vídeos", url: "/professor/videos", icon: Video },
];

const ADMINISTRACAO: Item[] = [
  ...(INSTITUICOES_ATIVAS ? [{ title: "Escolas e instituições", url: "/configuracoes/administracao/instituicoes", icon: Building2 }] : []),
  { title: "Métricas", url: "/configuracoes/administracao/metricas", icon: BarChart3 },
  { title: "Moderação", url: "/configuracoes/administracao/moderacao", icon: ShieldAlert },
  { title: "Plataforma", url: "/configuracoes/administracao/plataforma", icon: SlidersHorizontal },
  { title: "Professores", url: "/configuracoes/administracao/professores", icon: GraduationCap },
  { title: "Utilizadores", url: "/configuracoes/administracao/utilizadores", icon: UserCog },
];

function Grupo({ titulo, icone: Icone, itens, ativo, aoNavegar }: {
  titulo?: string;
  icone?: LucideIcon;
  itens: Item[];
  ativo: (url: string) => boolean;
  aoNavegar: () => void;
}) {
  return (
    <section aria-label={titulo}>
      {titulo && (
        <h3 className="flex items-center gap-2 px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {Icone && <Icone className="h-3.5 w-3.5" aria-hidden />}
          {titulo}
        </h3>
      )}
      <ul>
        {itens.map((item) => (
          <li key={item.url} className="border-b border-border/60 last:border-b-0">
            <Link
              href={item.url}
              onClick={aoNavegar}
              aria-current={ativo(item.url) ? "page" : undefined}
              className="flex min-h-14 items-center gap-3 px-2 py-2 transition-colors active:bg-surface"
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  ativo(item.url) ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="flex-1 text-base font-medium text-foreground">{item.title}</span>
              {!!item.contador && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">{item.contador}</span>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Barra de navegação flutuante, só em telemóvel e tablet (abaixo de 1024px). */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);
  const [aSair, setASair] = useState(false);

  const ativo = (url: string) =>
    url === "/inicio" ? pathname === "/inicio" : pathname === url || pathname.startsWith(url + "/");

  const escola = useInstituicaoOpcional();
  const papel = escola?.atual?.membro.papel ?? null;
  const contadores = escola?.contadores ?? { porRever: 0, trabalhos: 0, avisosPorLer: 0 };
  const abas = abasTelemovel(papel, contadores).map(paraItem);
  const resto = restoParaMais(papel, contadores);
  const daEscola: Item[] = escola?.atual
    ? resto.escola.map(paraItem)
    : escola && !escola.aCarregar
      ? [{ title: "Entrar numa escola", url: "/instituicao/aderir", icon: Building2 }]
      : [];
  const geralNoMais = resto.geral.map(paraItem);

  const itensMais = [
    ...daEscola,
    ...geralNoMais,
    ...MAIS,
    ...(user?.isTeacher ? PROFESSOR : []),
    ...(user?.isStaff ? ADMINISTRACAO : []),
  ];
  // "Mais" fica ativo quando o painel está aberto ou a página pertence ao painel.
  // /configuracoes/administracao/* pertence ao grupo de administração.
  const maisAtivo = maisAberto || itensMais.some((i) => ativo(i.url));

  // Fecha o painel ao mudar de página.
  useEffect(() => setMaisAberto(false), [pathname]);

  const sair = async () => {
    if (aSair) return;
    setASair(true);
    try {
      await api.logout();
    } catch (err) {
      console.warn("logout warning:", err);
    } finally {
      window.location.assign(API_BASE_URL + "/");
    }
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] computador:hidden pointer-events-none"
      >
        <ul className="pointer-events-auto mx-auto flex max-w-xl items-end justify-between rounded-[1.75rem] border border-border bg-card/95 px-2 py-2 shadow-elevated backdrop-blur-md">
          {abas.map((aba) => {
            // "/instituicao" (painel) não fica ativo nas subpáginas que têm aba própria.
            const activa =
              !maisAberto &&
              (aba.url === "/instituicao" ? pathname === "/instituicao" : ativo(aba.url));
            return (
              <li key={aba.url} className="flex-1">
                <Link
                  href={aba.url}
                  aria-current={activa ? "page" : undefined}
                  aria-label={aba.contador ? `${aba.title} (${aba.contador} por ver)` : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium text-muted-foreground transition-colors"
                >
                  <span
                    className={cn(
                      "relative grid h-9 w-9 place-items-center rounded-full transition-colors",
                      activa && "bg-primary text-primary-foreground shadow-soft",
                    )}
                  >
                    <aba.icon className="h-5 w-5" aria-hidden />
                    {!!aba.contador && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground ring-2 ring-card" aria-hidden>
                        {aba.contador > 9 ? "9+" : aba.contador}
                      </span>
                    )}
                  </span>
                  <span className={cn(activa && "text-primary")}>{aba.title}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMaisAberto((o) => !o)}
              aria-haspopup="dialog"
              aria-expanded={maisAberto}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium text-muted-foreground transition-colors"
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full transition-colors",
                  maisAtivo && "bg-primary text-primary-foreground shadow-soft",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </span>
              <span className={cn(maisAtivo && "text-primary")}>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        {/* O painel sobe por cima do conteúdo mas deixa a barra de baixo visível. */}
        <SheetContent
          side="bottom"
          className="inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[55] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-3xl border bg-card px-4 pb-2 shadow-elevated outline-none focus:outline-none focus-visible:ring-0 computador:hidden [&>button]:hidden"
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="px-2 pt-3 text-left">
            <SheetTitle className="font-serif text-2xl">Mais</SheetTitle>
            <SheetDescription className="sr-only">Outras páginas da plataforma EYK.</SheetDescription>
          </SheetHeader>

          {user?.isTeacher && (
            <Grupo titulo="Professor" icone={LayoutDashboard} itens={PROFESSOR} ativo={ativo} aoNavegar={() => setMaisAberto(false)} />
          )}
          {daEscola.length > 0 && (
            <Grupo
              titulo={escola?.atual ? escola.atual.instituicao.nome : "Escola"}
              icone={Building2}
              itens={daEscola}
              ativo={ativo}
              aoNavegar={() => setMaisAberto(false)}
            />
          )}
          {geralNoMais.length > 0 && (
            <Grupo titulo="Plataforma EYK" icone={Home} itens={geralNoMais} ativo={ativo} aoNavegar={() => setMaisAberto(false)} />
          )}
          <Grupo titulo={daEscola.length || geralNoMais.length || user?.isTeacher ? "Mais" : undefined} itens={MAIS} ativo={ativo} aoNavegar={() => setMaisAberto(false)} />
          {user?.isStaff && (
            <Grupo titulo="Administração" icone={ShieldCheck} itens={ADMINISTRACAO} ativo={ativo} aoNavegar={() => setMaisAberto(false)} />
          )}

          <button
            type="button"
            onClick={sair}
            disabled={aSair}
            className="mt-2 flex min-h-14 w-full items-center gap-3 border-t border-border/60 px-2 py-2 text-left text-destructive"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10">
              <LogOut className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base font-medium">{aSair ? "A sair…" : "Sair"}</span>
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
