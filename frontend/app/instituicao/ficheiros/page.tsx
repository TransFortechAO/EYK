"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Baby, FileAudio, FileText, FileVideo, FolderOpen, HardDrive, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/eyk";
import { useConfirm } from "@/components/confirm-dialog";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import {
  acao,
  Barra,
  Caixa,
  Campo,
  Carregando,
  ErroCarregar,
  erroTexto,
  EscolherDestinatarios,
  Etiqueta,
  haQuanto,
  rotuloDestinatarios,
  Seletor,
  tamanho,
  useCarregar,
} from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import type { CategoriaFicheiro, Destinatarios, FicheiroInstituicao, Grupo } from "@/lib/instituicoes/tipos";

const ICONE: Record<CategoriaFicheiro, React.ComponentType<{ className?: string }>> = {
  documento: FileText,
  imagem: ImageIcon,
  audio: FileAudio,
  video: FileVideo,
};
const ROTULO_CATEGORIA: Record<CategoriaFicheiro, string> = { documento: "Documentos", imagem: "Imagens", audio: "Áudio", video: "Vídeo" };

export default function FicheirosPage() {
  const { instituicaoId, pode, atual } = useInstituicaoAtual();
  const confirmar = useConfirm();
  const [categoria, setCategoria] = useState<CategoriaFicheiro | "">("");
  const [carregar, setCarregar] = useState(false);

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [ficheiros, grupos, uso] = await Promise.all([
      api.listarFicheiros(instituicaoId),
      pode("carregar_ficheiros") || pode("ver_todos_grupos") ? api.listarGrupos(instituicaoId) : Promise.resolve([]),
      api.usoArmazenamento(instituicaoId),
    ]);
    return { ficheiros, grupos, uso };
  }, [instituicaoId]);

  // Enquanto houver ficheiros a verificar, volta a perguntar de vez em quando.
  const aVerificar = dados?.ficheiros.some((f) => f.estado === "a_verificar");
  useEffect(() => {
    if (!aVerificar) return;
    const t = setTimeout(() => void recarregar(), 5000);
    return () => clearTimeout(t);
  }, [aVerificar, dados, recarregar]);

  const abrir = async (f: FicheiroInstituicao) => {
    try {
      await api.abrirFicheiro(instituicaoId, f.id);
      toast.info(`«${f.nome}»`, { description: "Na demonstração o ficheiro não é descarregado. A permissão foi verificada." });
    } catch (err) {
      toast.error(erroTexto(err));
    }
  };

  const apagar = async (f: FicheiroInstituicao) => {
    if (!(await confirmar({ title: `Apagar «${f.nome}»?`, description: "Deixa de estar disponível para todos. Fica registado na auditoria.", confirmLabel: "Apagar", destructive: true }))) return;
    if (await acao(() => api.removerFicheiro(instituicaoId, f.id), "Ficheiro apagado.")) await recarregar();
  };

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const lista = dados.ficheiros.filter((f) => !categoria || f.categoria === categoria);
  const podeApagar = (f: FicheiroInstituicao) => pode("gerir_membros") || (pode("carregar_ficheiros") && f.carregadoPor === atual.membro.nome);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Ficheiros</h2>
          <p className="text-sm text-muted-foreground">Documentos, imagens, áudio e vídeo partilhados pela instituição.</p>
        </div>
        <div className="flex gap-2">
          <Seletor aria-label="Filtrar por tipo" className="w-40" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaFicheiro | "")}>
            <option value="">Todos os tipos</option>
            {(Object.keys(ROTULO_CATEGORIA) as CategoriaFicheiro[]).map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </Seletor>
          {pode("carregar_ficheiros") && (
            <Button className="gap-1.5" onClick={() => setCarregar(true)}>
              <Upload className="h-4 w-4" /> Carregar
            </Button>
          )}
        </div>
      </div>

      {pode("gerir_definicoes") && (
        <Card className="space-y-2 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden /> Armazenamento da instituição
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {tamanho(dados.uso.usadoBytes)} de {tamanho(dados.uso.quotaBytes)}
            </p>
          </div>
          <Barra valor={dados.uso.usadoBytes} max={dados.uso.quotaBytes} rotulo="Armazenamento usado" />
          <p className="text-xs text-muted-foreground">
            Limite por ficheiro: {tamanho(dados.uso.ficheiroMaxBytes)}. As quotas são definidas pela equipa EYK. Os vídeos são o que
            ocupa mais espaço.
          </p>
        </Card>
      )}

      {lista.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Sem ficheiros" description="Os ficheiros partilhados contigo aparecem aqui." />
      ) : (
        <Card className="divide-y divide-border shadow-soft">
          {lista.map((f) => {
            const Icone = ICONE[f.categoria];
            return (
              <div key={f.id} id={f.id} className="flex scroll-mt-28 flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icone className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {tamanho(f.tamanhoBytes)} · {rotuloDestinatarios(f.visibilidade, dados.grupos)} · {f.carregadoPor}, {haQuanto(f.carregadoEm)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {f.temCriancas && (
                    <Etiqueta tom="aviso">
                      <Baby className="h-3 w-3" aria-hidden /> Com crianças
                    </Etiqueta>
                  )}
                  {f.estado === "a_verificar" ? (
                    <Etiqueta>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> A verificar
                    </Etiqueta>
                  ) : f.estado === "bloqueado" ? (
                    <Etiqueta tom="perigo">Bloqueado</Etiqueta>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void abrir(f)}>
                      Abrir
                    </Button>
                  )}
                  {podeApagar(f) && (
                    <Button size="icon" variant="ghost" aria-label={`Apagar ${f.nome}`} className="text-muted-foreground hover:text-destructive" onClick={() => void apagar(f)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {pode("carregar_ficheiros") && (
        <CarregarFicheiro
          aberto={carregar}
          grupos={dados.grupos}
          maxBytes={dados.uso.ficheiroMaxBytes}
          aoFechar={() => setCarregar(false)}
          aoCarregar={async () => {
            setCarregar(false);
            await recarregar();
          }}
        />
      )}
    </div>
  );
}

function CarregarFicheiro({
  aberto,
  grupos,
  maxBytes,
  aoFechar,
  aoCarregar,
}: {
  aberto: boolean;
  grupos: Grupo[];
  maxBytes: number;
  aoFechar: () => void;
  aoCarregar: () => void;
}) {
  const { instituicaoId, pode } = useInstituicaoAtual();
  const podeInstituicao = pode("gerir_membros");
  const entrada = useRef<HTMLInputElement>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [destino, setDestino] = useState<Destinatarios>(podeInstituicao ? { tipo: "instituicao" } : { tipo: "grupo", grupoId: grupos[0]?.id ?? "" });
  const [temCriancas, setTemCriancas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!ficheiro) return;
    setErro(null);
    setAEnviar(true);
    try {
      await api.carregarFicheiro(instituicaoId, {
        nome: ficheiro.name,
        tamanhoBytes: ficheiro.size,
        mime: ficheiro.type,
        visibilidade: destino,
        temCriancas,
      });
      setFicheiro(null);
      setTemCriancas(false);
      if (entrada.current) entrada.current.value = "";
      toast.success("Ficheiro carregado. Fica disponível depois da verificação automática.");
      aoCarregar();
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  const multimedia = ficheiro && /^(image|video)\//.test(ficheiro.type);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Carregar ficheiro</DialogTitle>
            <DialogDescription>Documentos, imagens, áudio ou vídeo, até {tamanho(maxBytes)}.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submeter} className="flex min-h-0 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <Campo id="cf-ficheiro" rotulo="Ficheiro">
              <input
                ref={entrada}
                id="cf-ficheiro"
                type="file"
                accept=".pdf,.doc,.docx,.odt,.txt,.xls,.xlsx,.ppt,.pptx,image/*,audio/*,video/*,.zip"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFicheiro(f);
                  setErro(f && f.size > maxBytes ? `O ficheiro passa o limite de ${tamanho(maxBytes)}.` : null);
                }}
                required
              />
            </Campo>
            {ficheiro && (
              <p className="text-xs text-muted-foreground">
                {ficheiro.name} · {tamanho(ficheiro.size)}
              </p>
            )}
            <Campo id="cf-dest" rotulo="Quem pode ver">
              <EscolherDestinatarios id="cf-dest" valor={destino} onChange={setDestino} grupos={grupos} podeInstituicao={podeInstituicao} />
            </Campo>
            <Caixa
              id="cf-criancas"
              checked={temCriancas}
              onChange={setTemCriancas}
              descricao="Só é publicado se todas as crianças do grupo tiverem o consentimento para fotografias e vídeos."
            >
              Tem fotografias ou vídeos de crianças
            </Caixa>
            {multimedia && !temCriancas && (
              <p className="text-xs text-muted-foreground">É uma imagem ou um vídeo: confirma se aparecem crianças.</p>
            )}
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="flex justify-end gap-2 space-y-0">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={aEnviar || !ficheiro} className="gap-1.5">
              <Upload className="h-4 w-4" /> {aEnviar ? "A carregar…" : "Carregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
