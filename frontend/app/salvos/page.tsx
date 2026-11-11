"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Building2, GraduationCap, MessageSquare, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CourseCard, EmptyState, PageHeader, PostCard, SectionHeader, VideoCard } from "@/components/eyk";
import { BotaoSalvar, useSalvos } from "@/components/ds/botao-salvar";
import { useSecoesMoveis } from "@/components/ds/secoes-moveis";
import { useInstituicaoOpcional } from "@/components/instituicao/contexto";
import { CartaoConteudoEscola, soEscola } from "@/components/instituicao/escola";
import { Carregando, contem, haQuanto } from "@/components/instituicao/ui";
import { CampoPesquisaPagina, usePesquisaPagina } from "@/components/pesquisa-pagina";
import { api, type Course, type Post, type Video } from "@/lib/api";
import { apiLgaReal, type SalvosEscola } from "@/lib/instituicoes/servidor-lga";

type Publicos = { cursos: Course[]; videos: Video[]; posts: Post[] };

const NADA: Publicos = { cursos: [], videos: [], posts: [] };

export default function SalvosPage() {
  const ctx = useInstituicaoOpcional();
  const salvos = useSalvos();
  const [q] = usePesquisaPagina();
  const [publicos, setPublicos] = useState<Publicos | null>(null);
  const [escola, setEscola] = useState<SalvosEscola | null>(null);
  const escolaId = salvos?.escolaId ?? null;
  // O aluno que só vê a escola não tem salvos da plataforma geral.
  const soDaEscola = !!ctx && soEscola(ctx);
  const aCarregarEscola = !!ctx?.aCarregar;

  useEffect(() => {
    if (aCarregarEscola) return;
    let vivo = true;
    void Promise.all([
      soDaEscola ? Promise.resolve(NADA) : api.salvos.listar().catch(() => NADA),
      escolaId ? apiLgaReal.listarSalvos(escolaId).catch(() => null) : Promise.resolve(null),
    ]).then(([p, e]) => {
      if (!vivo) return;
      setPublicos(p);
      setEscola(e);
    });
    return () => {
      vivo = false;
    };
  }, [soDaEscola, escolaId, aCarregarEscola]);

  const secoes = useMemo(
    () => [
      ...(soDaEscola ? [] : [
        { id: "cursos", rotulo: "Cursos", icone: GraduationCap },
        { id: "videos", rotulo: "Vídeos", icone: PlayCircle },
        { id: "posts", rotulo: "Publicações", icone: MessageSquare },
      ]),
      ...(escolaId ? [{ id: "escola", rotulo: "Da escola", icone: Building2 }] : []),
    ],
    [soDaEscola, escolaId],
  );
  const { so, separadores } = useSecoesMoveis(secoes);

  // Ao tirar dos Salvos, o item sai logo da lista.
  const manter = (tipo: Parameters<NonNullable<typeof salvos>["tem"]>[0], id: string | number) => !salvos || salvos.tem(tipo, id);
  const cursos = (publicos?.cursos ?? []).filter((c) => manter("curso", c.id) && contem(q, c.title, c.teacher));
  const videos = (publicos?.videos ?? []).filter((v) => manter("video", v.id) && contem(q, v.title, v.teacher));
  const posts = (publicos?.posts ?? []).filter((p) => manter("post", p.id) && contem(q, p.content, p.author));
  const conteudos = (escola?.conteudos ?? []).filter((c) => manter("conteudo", c.id) && contem(q, c.titulo, c.descricao, c.autor));
  const aulas = (escola?.aulas ?? []).filter((a) => manter("aula", a.id) && contem(q, a.titulo, a.descricao, a.turmaNome));
  const postsTurma = (escola?.posts ?? []).filter((p) => manter("post_turma", p.id) && contem(q, p.texto, p.autorNome, p.turmaNome));
  const totalEscola = conteudos.length + aulas.length + postsTurma.length;
  const vazio = cursos.length + videos.length + posts.length + totalEscola === 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Salvos" description="O que guardaste para ver depois. Só tu vês esta lista." />
      <CampoPesquisaPagina className="computador:hidden" />

      {!publicos ? (
        <Carregando />
      ) : vazio ? (
        <EmptyState
          icon={Bookmark}
          title={q ? "Nada encontrado nos Salvos" : "Ainda não guardaste nada"}
          description={q ? "Experimenta outra palavra." : "Toca no marcador de um curso, vídeo ou publicação para o guardares aqui."}
        />
      ) : (
        <>
          {separadores}

          {!soDaEscola && (
            <>
              <section className={so("cursos")}>
                <SectionHeader title="Cursos" />
                {cursos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem cursos guardados.</p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {cursos.map((c) => (
                      <CourseCard key={c.id} course={c} />
                    ))}
                  </div>
                )}
              </section>

              <section className={so("videos")}>
                <SectionHeader title="Vídeos" />
                {videos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem vídeos guardados.</p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {videos.map((v) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                  </div>
                )}
              </section>

              <section className={so("posts")}>
                <SectionHeader title="Publicações" />
                {posts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem publicações guardadas.</p>
                ) : (
                  <div className="mx-auto max-w-2xl space-y-4">
                    {posts.map((p) => (
                      <PostCard key={p.id} post={p} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {escolaId && (
            <section className={so("escola")}>
              <SectionHeader title={ctx?.atual?.instituicao.nome ?? "Da escola"} />
              {totalEscola === 0 ? (
                <p className="text-sm text-muted-foreground">Sem nada guardado da escola.</p>
              ) : (
                <div className="space-y-5">
                  {conteudos.length > 0 && (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {conteudos.map((c) => (
                        <CartaoConteudoEscola key={c.id} conteudo={c} />
                      ))}
                    </div>
                  )}
                  {aulas.map((a) => (
                    <Card key={a.id} className="flex items-start justify-between gap-3 p-4 shadow-soft">
                      <Link href={`/instituicao/turmas/${a.turmaId}/aulas/${a.id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="font-medium">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">Aula · {a.turmaNome}</p>
                      </Link>
                      <BotaoSalvar tipo="aula" id={a.id} variante="acao" />
                    </Card>
                  ))}
                  {postsTurma.map((p) => (
                    <Card key={p.id} className="flex items-start justify-between gap-3 p-4 shadow-soft">
                      <Link href={`/instituicao/turmas/${p.turmaId}?separador=comunidade`} className="min-w-0 flex-1 hover:underline">
                        <p className="text-sm font-medium">
                          {p.autorNome.split(" ")[0]} <span className="text-xs font-normal text-muted-foreground">· {p.turmaNome} · {haQuanto(p.criadoEm)}</span>
                        </p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{p.texto || "Fotografia"}</p>
                      </Link>
                      <BotaoSalvar tipo="post_turma" id={p.id} variante="acao" />
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
