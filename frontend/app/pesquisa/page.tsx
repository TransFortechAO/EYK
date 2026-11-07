"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, GraduationCap, MessageSquare, PlayCircle, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseCard, EmptyState, PageHeader, PostCard, SectionHeader, VideoCard } from "@/components/eyk";
import { BarraFiltros, normalizarTexto, type DefFiltro } from "@/components/filtros/barra-filtros";
import { useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { CartaoConteudoEscola, soEscola } from "@/components/instituicao/escola";
import { Carregando } from "@/components/instituicao/ui";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import { api, type Course, type Post, type UtilizadorPesquisa, type Video } from "@/lib/api";
import { apiLga } from "@/lib/instituicoes/lga";
import type { ConteudoEscola } from "@/lib/instituicoes/tipos";

type Tipo = "todos" | "cursos" | "videos" | "posts" | "pessoas" | "escola";
type Resultados = { cursos: Course[]; videos: Video[]; posts: Post[]; pessoas: UtilizadorPesquisa[]; escola: ConteudoEscola[] };

const VAZIO: Resultados = { cursos: [], videos: [], posts: [], pessoas: [], escola: [] };
/** Na vista "Tudo", quantos de cada tipo; o resto vê-se no separador desse tipo. */
const NO_RESUMO = 4;

const ORDEM_CURSOS: Record<string, (a: Course, b: Course) => number> = {
  recentes: (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  populares: (a, b) => b.students - a.students,
  avaliados: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
};
const ORDEM_VIDEOS: Record<string, (a: Video, b: Video) => number> = {
  recentes: (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  vistos: (a, b) => b.views - a.views,
};
const ORDEM_POSTS: Record<string, (a: Post, b: Post) => number> = {
  gostos: (a, b) => b.likes - a.likes,
  comentarios: (a, b) => b.comments - a.comments,
};

const opcoes = (valores: string[]) => [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")).map((v) => ({ valor: v, rotulo: v }));

export default function PesquisaPage() {
  const ctx = useInstituicaoOpcional();
  const [q, definirQ] = usePesquisaPagina();
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Resultados | null>(null);
  const termo = q.trim();
  const instituicaoId = ctx?.atual?.instituicao.id ?? null;
  // O aluno que só vê a escola pesquisa só na escola.
  const soDaEscola = !!ctx && soEscola(ctx);

  useEffect(() => {
    if (termo.length < 2) {
      setRes(VAZIO);
      return;
    }
    let vivo = true;
    setRes(null);
    const espera = setTimeout(() => {
      const norm = normalizarTexto(termo);
      void Promise.all([
        soDaEscola ? Promise.resolve({ cursos: [], videos: [], posts: [] }) : api.pesquisar(termo),
        soDaEscola ? Promise.resolve([]) : api.pesquisarUtilizadores(termo),
        instituicaoId
          ? apiLga
              .listarConteudos(instituicaoId)
              .then((l) => l.filter((c) => normalizarTexto(`${c.titulo} ${c.descricao} ${c.autor}`).includes(norm)))
              .catch(() => [])
          : Promise.resolve([]),
      ]).then(([publicos, pessoas, escola]) => vivo && setRes({ ...publicos, pessoas, escola }));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [termo, soDaEscola, instituicaoId]);

  // Cada separador tem os seus filtros; os de um não ficam presos ao mudar para outro.
  const mudarTipo = (t: Tipo) => {
    setTipo(t);
    setValores({});
  };

  const filtros: DefFiltro[] = useMemo(() => {
    const r = res ?? VAZIO;
    const ordem = (rotulo: string, lista: { valor: string; rotulo: string }[]): DefFiltro => ({
      id: "ordem", rotulo: "Ordenar", todos: rotulo, visivelPorOmissao: true, opcoes: lista,
    });
    if (tipo === "cursos") {
      return [
        { id: "categoria", rotulo: "Categoria", todos: "Todas as categorias", visivelPorOmissao: true, opcoes: opcoes(r.cursos.map((c) => c.category)) },
        { id: "nivel", rotulo: "Nível", todos: "Todos os níveis", visivelPorOmissao: true, opcoes: opcoes(["Iniciante", "Intermédio", "Avançado"]) },
        { id: "professor", rotulo: "Professor", todos: "Todos os professores", visivelPorOmissao: false, opcoes: opcoes(r.cursos.map((c) => c.teacher)) },
        ordem("Ordenar: relevância", [{ valor: "recentes", rotulo: "Mais recentes" }, { valor: "populares", rotulo: "Mais alunos" }, { valor: "avaliados", rotulo: "Melhor avaliados" }]),
      ];
    }
    if (tipo === "videos") {
      return [
        { id: "professor", rotulo: "Professor", todos: "Todos os professores", visivelPorOmissao: true, opcoes: opcoes(r.videos.map((v) => v.teacher)) },
        ordem("Ordenar: mais recentes", [{ valor: "vistos", rotulo: "Mais vistos" }]),
      ];
    }
    if (tipo === "posts") return [ordem("Ordenar: mais recentes", [{ valor: "gostos", rotulo: "Mais gostos" }, { valor: "comentarios", rotulo: "Mais comentados" }])];
    if (tipo === "pessoas") {
      return [{ id: "papel", rotulo: "Quem", todos: "Todas as pessoas", visivelPorOmissao: true, opcoes: [{ valor: "professores", rotulo: "Professores" }, { valor: "estudantes", rotulo: "Estudantes" }] }];
    }
    if (tipo === "escola") {
      return [{ id: "formato", rotulo: "Formato", todos: "Cursos e vídeos", visivelPorOmissao: true, opcoes: [{ valor: "curso", rotulo: "Cursos" }, { valor: "video", rotulo: "Vídeos" }] }];
    }
    return [];
  }, [tipo, res]);

  const r = res ?? VAZIO;
  const ordenar = <T,>(lista: T[], mapa: Record<string, (a: T, b: T) => number>) => (mapa[valores.ordem] ? [...lista].sort(mapa[valores.ordem]) : lista);
  const cursos = ordenar(
    r.cursos.filter((c) => (!valores.categoria || c.category === valores.categoria) && (!valores.nivel || c.level === valores.nivel) && (!valores.professor || c.teacher === valores.professor)),
    ORDEM_CURSOS,
  );
  const videos = ordenar(r.videos.filter((v) => !valores.professor || v.teacher === valores.professor), ORDEM_VIDEOS);
  const posts = ordenar(r.posts, ORDEM_POSTS);
  const pessoas = r.pessoas.filter((p) => !valores.papel || (valores.papel === "professores") === p.isTeacher);
  const escola = r.escola.filter((c) => !valores.formato || c.tipo === valores.formato);

  const contagens: Record<Tipo, number> = {
    todos: r.cursos.length + r.videos.length + r.posts.length + r.pessoas.length + r.escola.length,
    cursos: r.cursos.length,
    videos: r.videos.length,
    posts: r.posts.length,
    pessoas: r.pessoas.length,
    escola: r.escola.length,
  };
  const separadores: { id: Tipo; rotulo: string; icone?: typeof Search }[] = soDaEscola
    ? [{ id: "escola", rotulo: "Da escola", icone: Building2 }]
    : [
        { id: "todos", rotulo: "Tudo" },
        { id: "cursos", rotulo: "Cursos", icone: GraduationCap },
        { id: "videos", rotulo: "Vídeos", icone: PlayCircle },
        { id: "posts", rotulo: "Publicações", icone: MessageSquare },
        { id: "pessoas", rotulo: "Pessoas", icone: Users },
        ...(instituicaoId ? [{ id: "escola" as const, rotulo: "Da escola", icone: Building2 }] : []),
      ];
  const efetivo: Tipo = separadores.some((s) => s.id === tipo) ? tipo : separadores[0].id;
  const resumo = efetivo === "todos";
  const ver = (t: Tipo) => resumo || efetivo === t;
  const corta = <T,>(lista: T[]) => (resumo ? lista.slice(0, NO_RESUMO) : lista);
  const verTodos = (t: Tipo, n: number) =>
    resumo && n > NO_RESUMO ? (
      <button type="button" onClick={() => mudarTipo(t)} className="text-sm font-medium text-primary hover:underline">
        Ver todos ({n})
      </button>
    ) : null;

  const lista = (
    <div className="space-y-10">
      {ver("cursos") && cursos.length > 0 && (
        <section>
          <SectionHeader title="Cursos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {corta(cursos).map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
          <div className="mt-3">{verTodos("cursos", cursos.length)}</div>
        </section>
      )}
      {ver("videos") && videos.length > 0 && (
        <section>
          <SectionHeader title="Vídeos" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {corta(videos).map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
          <div className="mt-3">{verTodos("videos", videos.length)}</div>
        </section>
      )}
      {ver("escola") && escola.length > 0 && (
        <section>
          <SectionHeader title={ctx?.atual?.instituicao.nome ?? "Da escola"} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {corta(escola).map((c) => <CartaoConteudoEscola key={c.id} conteudo={c} />)}
          </div>
          <div className="mt-3">{verTodos("escola", escola.length)}</div>
        </section>
      )}
      {ver("pessoas") && pessoas.length > 0 && (
        <section>
          <SectionHeader title="Pessoas" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {corta(pessoas).map((p) => (
              <Link key={p.id} href={`/perfil/${p.id}`} className="group">
                <Card className="flex items-center gap-3 p-4 shadow-soft transition-shadow group-hover:shadow-elevated">
                  <Avatar className="h-11 w-11">
                    {p.foto && <AvatarImage src={p.foto} alt="" className="object-cover" />}
                    <AvatarFallback className="bg-gradient-gold font-semibold uppercase text-primary-foreground">{p.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:underline">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{p.username}
                      {p.isTeacher && " · Professor"}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-3">{verTodos("pessoas", pessoas.length)}</div>
        </section>
      )}
      {ver("posts") && posts.length > 0 && (
        <section>
          <SectionHeader title="Publicações" />
          <div className="mx-auto max-w-2xl space-y-4">
            {corta(posts).map((p) => <PostCard key={p.id} post={p} />)}
          </div>
          <div className="mx-auto mt-3 max-w-2xl">{verTodos("posts", posts.length)}</div>
        </section>
      )}
    </div>
  );
  const nadaNoTipo = resumo ? contagens.todos === 0 : { cursos, videos, posts, pessoas, escola, todos: [] }[efetivo].length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={termo ? `Resultados para «${termo}»` : "Pesquisa"}
        gesto="Pesquisar"
        description={soDaEscola ? "Cursos e vídeos da tua escola." : "Cursos, vídeos, publicações e pessoas em toda a EYK."}
      />

      {filtros.length > 0 ? (
        <BarraFiltros
          chave={`eyk-filtros-pesquisa-${efetivo}`}
          filtros={filtros}
          valores={valores}
          aoMudar={(id, valor) => setValores((v) => ({ ...v, [id]: valor }))}
          pesquisa={q}
          aoLimpar={() => {
            definirQ("");
            setValores({});
          }}
        />
      ) : (
        <CampoPesquisaPagina className="computador:hidden" />
      )}

      {separadores.length > 1 && (
        <Tabs value={efetivo} onValueChange={(v) => mudarTipo(v as Tipo)}>
          <TabsList className="h-auto w-full flex-wrap justify-start bg-surface p-1 sm:w-auto">
            {separadores.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-1.5 text-xs sm:text-sm">
                {s.icone && <s.icone className="h-4 w-4" aria-hidden />}
                {s.rotulo}
                {res && termo.length >= 2 && <span className="tabular-nums text-muted-foreground">{contagens[s.id]}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {termo.length < 2 ? (
        <EmptyState icon={Search} title="O que procuras?" description="Escreve pelo menos duas letras: um curso, um vídeo, um tema ou o nome de alguém." />
      ) : !res ? (
        <Carregando texto="A pesquisar…" />
      ) : nadaNoTipo ? (
        <EmptyState icon={Search} title={`Nada encontrado para «${termo}»`} description="Experimenta outras palavras ou tira os filtros." />
      ) : (
        lista
      )}
    </div>
  );
}
