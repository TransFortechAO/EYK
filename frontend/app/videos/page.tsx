"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";
import { PageHeader, SectionHeader, VideoCard, EmptyState } from "@/components/eyk";
import { api, type Video } from "@/lib/api";
import { ConteudosComEscola } from "@/components/instituicao/escola";
import { BarraFiltros, minutosDeDuracao, normalizarTexto, type DefFiltro } from "@/components/filtros/barra-filtros";

const SEM_FILTROS: Record<string, string> = { duracao: "", professor: "", publicado: "", ordem: "" };

const ORDENAR: Record<string, (a: Video, b: Video) => number> = {
  vistos: (a, b) => b.views - a.views,
  antigos: (a, b) => b.daysAgo - a.daysAgo,
  curtos: (a, b) => minutosDeDuracao(a.duration) - minutosDeDuracao(b.duration),
};

function dentroDaDuracao(v: Video, faixa: string): boolean {
  const min = minutosDeDuracao(v.duration);
  if (faixa === "curto") return min < 6;
  if (faixa === "medio") return min >= 6 && min <= 20;
  if (faixa === "longo") return min > 20;
  return true;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [valores, setValores] = useState(SEM_FILTROS);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Vêm do mais recente para o mais antigo; o resto filtra-se e ordena-se aqui.
      const list = await api.getVideos("recent");
      if (alive) setVideos(list);
    })();
    return () => { alive = false; };
  }, []);

  const filtros: DefFiltro[] = useMemo(() => {
    const professores = [...new Set(videos.map((v) => v.teacher))].sort((a, b) => a.localeCompare(b, "pt"));
    return [
      { id: "duracao", rotulo: "Duração", todos: "Qualquer duração", visivelPorOmissao: true,
        opcoes: [
          { valor: "curto", rotulo: "Curtos (menos de 6 min)" },
          { valor: "medio", rotulo: "Médios (6 a 20 min)" },
          { valor: "longo", rotulo: "Longos (mais de 20 min)" },
        ] },
      { id: "professor", rotulo: "Professor", todos: "Todos os professores", visivelPorOmissao: true,
        opcoes: professores.map((p) => ({ valor: p, rotulo: p })) },
      { id: "publicado", rotulo: "Data de publicação", todos: "Qualquer data", visivelPorOmissao: false,
        opcoes: [
          { valor: "7", rotulo: "Última semana" },
          { valor: "30", rotulo: "Último mês" },
          { valor: "365", rotulo: "Último ano" },
        ] },
      { id: "ordem", rotulo: "Ordenar", todos: "Mais recentes", visivelPorOmissao: true,
        opcoes: [
          { valor: "vistos", rotulo: "Mais vistos" },
          { valor: "curtos", rotulo: "Mais curtos" },
          { valor: "antigos", rotulo: "Mais antigos" },
        ] },
    ];
  }, [videos]);

  const filtrados = useMemo(() => {
    const termo = normalizarTexto(pesquisa.trim());
    const lista = videos.filter(
      (v) =>
        (!termo || normalizarTexto(`${v.title} ${v.teacher}`).includes(termo)) &&
        dentroDaDuracao(v, valores.duracao) &&
        (!valores.professor || v.teacher === valores.professor) &&
        (!valores.publicado || v.daysAgo <= Number(valores.publicado)),
    );
    const ordenar = ORDENAR[valores.ordem];
    return ordenar ? [...lista].sort(ordenar) : lista;
  }, [videos, pesquisa, valores]);

  const limpar = () => {
    setPesquisa("");
    setValores(SEM_FILTROS);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vídeos"
        description="Aulas e explicações em vídeo, partilhadas pelos professores da plataforma EYK."
      />

      {/* Com escola parceira: "Da minha escola" ao lado do catálogo público. */}
      <ConteudosComEscola tipo="video">
        <BarraFiltros
          chave="eyk-filtros-videos"
          filtros={filtros}
          valores={valores}
          aoMudar={(id, valor) => setValores((v) => ({ ...v, [id]: valor }))}
          pesquisa={pesquisa}
          aoPesquisar={setPesquisa}
          placeholderPesquisa="Pesquisar vídeos por título ou professor…"
          aoLimpar={limpar}
        />

        <section>
          <SectionHeader title={`${filtrados.length} vídeo${filtrados.length === 1 ? "" : "s"} encontrado${filtrados.length === 1 ? "" : "s"}`} />
          {filtrados.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={PlayCircle}
              title={videos.length === 0 ? "Nenhum vídeo disponível." : "Nenhum vídeo com estes filtros."}
              description={videos.length === 0 ? undefined : "Muda ou limpa os filtros para veres mais vídeos."}
            />
          )}
        </section>
      </ConteudosComEscola>
    </div>
  );
}
