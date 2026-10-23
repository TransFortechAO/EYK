"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Database,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  LayoutDashboard,
  Megaphone,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  UsersRound,
  Baby,
  Hand,
  Dumbbell,
  BookA,
  Library,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/eyk";
import { Button } from "@/components/ui/button";
import { InstituicaoProvider, useInstituicao } from "@/components/instituicao/contexto";
import { Carregando, EtiquetaPapel, Seletor } from "@/components/instituicao/ui";
import { INSTITUICOES_ATIVAS } from "@/lib/instituicoes/ativo";
import { PESSOAS_DEMO } from "@/lib/instituicoes/api";
import { acessoBloqueado, pode, ROTULO_ESTADO_INSTITUICAO, ROTULO_TIPO_INSTITUICAO } from "@/lib/instituicoes/permissoes";
import type { Papel } from "@/lib/instituicoes/tipos";
import { cn } from "@/lib/utils";

type ItemNav = { titulo: string; url: string; icone: LucideIcon; visivel: (p: Papel) => boolean };

const NAV: ItemNav[] = [
  { titulo: "Painel", url: "/instituicao", icone: LayoutDashboard, visivel: (p) => pode(p, "ver_painel") },
  { titulo: "Turmas LGA", url: "/instituicao/turmas", icone: Hand, visivel: (p) => pode(p, "ver_turmas_lga") },
  { titulo: "Praticar", url: "/instituicao/praticar", icone: Dumbbell, visivel: (p) => pode(p, "praticar") },
  { titulo: "Gestuário", url: "/instituicao/gestuario", icone: BookA, visivel: (p) => pode(p, "praticar") || pode(p, "propor_gestos") },
  { titulo: "Conteúdos", url: "/instituicao/conteudos", icone: Library, visivel: (p) => pode(p, "ver_turmas_lga") },
  { titulo: "Avisos", url: "/instituicao/avisos", icone: Megaphone, visivel: (p) => pode(p, "ver_avisos") },
  { titulo: "Agenda", url: "/instituicao/agenda", icone: CalendarDays, visivel: (p) => pode(p, "ver_agenda") },
  { titulo: "Ficheiros", url: "/instituicao/ficheiros", icone: FolderOpen, visivel: (p) => pode(p, "ver_ficheiros") },
  { titulo: "Grupos", url: "/instituicao/grupos", icone: UsersRound, visivel: (p) => pode(p, "gerir_grupos") || pode(p, "ver_todos_grupos") },
  {
    titulo: "Alunos",
    url: "/instituicao/alunos",
    icone: Baby,
    visivel: (p) => pode(p, "gerir_alunos") || p === "familia" || (pode(p, "ver_todos_grupos") && p !== "observador"),
  },
  { titulo: "Membros", url: "/instituicao/membros", icone: Users, visivel: (p) => ["administrador", "coordenador", "educador", "formador"].includes(p) },
  { titulo: "Convites", url: "/instituicao/convites", icone: Ticket, visivel: (p) => pode(p, "convidar") },
  { titulo: "Consentimentos", url: "/instituicao/consentimentos", icone: ShieldCheck, visivel: (p) => pode(p, "ver_consentimentos") || pode(p, "dar_consentimento") },
  { titulo: "Relatórios", url: "/instituicao/relatorios", icone: BarChart3, visivel: (p) => pode(p, "ver_relatorios") },
  { titulo: "Auditoria", url: "/instituicao/auditoria", icone: History, visivel: (p) => pode(p, "ver_auditoria") },
  { titulo: "Os meus dados", url: "/instituicao/dados", icone: Database, visivel: (p) => pode(p, "pedir_dados") },
  { titulo: "Definições", url: "/instituicao/definicoes", icone: Settings2, visivel: (p) => pode(p, "gerir_definicoes") },
];

/** Rotas que funcionam sem instituição atual (ex: aderir com um código). */
const SEM_INSTITUICAO = ["/instituicao/aderir"];

function ativo(pathname: string, url: string) {
  return url === "/instituicao" ? pathname === url : pathname === url || pathname.startsWith(url + "/");
}

function FaixaDemo() {
  const { pessoa, mudarPessoa, reporDados } = useInstituicao();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-muted-foreground">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Demonstração.</span> Os dados são fictícios e ficam só neste
          browser, até a eyk-api estar pronta.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="ver-como" className="text-xs font-medium text-muted-foreground">
          Ver como
        </label>
        <Seletor id="ver-como" className="h-8 w-auto min-w-52 text-xs" value={pessoa} onChange={(e) => mudarPessoa(Number(e.target.value))}>
          {PESSOAS_DEMO.map((p) => (
            <option key={p.utilizadorId} value={p.utilizadorId}>
              {p.nome} — {p.descricao}
            </option>
          ))}
        </Seletor>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={reporDados} title="Voltar aos dados iniciais">
          <RotateCcw className="h-3.5 w-3.5" /> Repor
        </Button>
      </div>
    </div>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { aCarregar, pertencas, atual, escolher } = useInstituicao();
  const semInstituicao = SEM_INSTITUICAO.some((r) => pathname.startsWith(r));

  if (aCarregar && !atual && !semInstituicao) {
    return (
      <div className="space-y-4">
        <FaixaDemo />
        <Carregando />
      </div>
    );
  }

  if (semInstituicao) {
    return (
      <div className="space-y-6">
        <FaixaDemo />
        {children}
      </div>
    );
  }

  if (!atual) {
    return (
      <div className="space-y-6">
        <FaixaDemo />
        <EmptyState
          icon={Building2}
          title="Ainda não pertences a nenhuma instituição"
          description="Se a tua escola, centro ou associação usa o EYK, pede-lhes um convite ou um código de adesão."
          action={
            <Button asChild>
              <Link href="/instituicao/aderir">Tenho um código</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { instituicao, membro } = atual;
  const itens = NAV.filter((i) => i.visivel(membro.papel));

  return (
    <div className="space-y-6">
      <FaixaDemo />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-gold text-primary-foreground shadow-gold">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ROTULO_TIPO_INSTITUICAO[instituicao.tipo]} · {instituicao.provincia}
            </p>
            <h1 className="truncate font-serif text-2xl font-semibold sm:text-3xl">{instituicao.nome}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaPapel papel={membro.papel} />
          {pertencas.length > 1 && (
            <Seletor
              aria-label="Mudar de instituição"
              className="h-8 w-auto max-w-64 text-xs"
              value={instituicao.id}
              onChange={(e) => escolher(e.target.value)}
            >
              {pertencas.map((p) => (
                <option key={p.instituicao.id} value={p.instituicao.id}>
                  {p.instituicao.nome}
                </option>
              ))}
            </Seletor>
          )}
        </div>
      </header>

      {acessoBloqueado(instituicao.estado) ? (
        <EmptyState
          icon={FileText}
          title={`Instituição ${ROTULO_ESTADO_INSTITUICAO[instituicao.estado].toLowerCase()}`}
          description="O acesso está bloqueado. Os dados continuam guardados — fala com a equipa EYK."
        />
      ) : (
        <>
          <nav aria-label="Secções da instituição" className="-mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8">
            <ul className="flex w-max gap-1.5 border-b border-border pb-2">
              {itens.map((item) => {
                const a = ativo(pathname, item.url);
                return (
                  <li key={item.url}>
                    <Link
                      href={item.url}
                      aria-current={a ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11",
                        a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <item.icone className="h-4 w-4" aria-hidden />
                      {item.titulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* key: ao mudar de instituição ou de pessoa, as páginas recarregam do zero. */}
          <div key={`${instituicao.id}:${membro.id}`}>{children}</div>
        </>
      )}
    </div>
  );
}

export default function InstituicaoLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!INSTITUICOES_ATIVAS) router.replace("/inicio");
  }, [router]);

  if (!INSTITUICOES_ATIVAS) return null;

  return (
    <InstituicaoProvider>
      <Moldura>{children}</Moldura>
    </InstituicaoProvider>
  );
}
