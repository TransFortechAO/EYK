"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Flame,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Tags,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, mensagemDeErro, tempoRelativo, type Anuncio, type CategoriaAdmin, type ConfigAdmin } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { useConfirm } from "@/components/confirm-dialog";
import { PageHeader, SectionHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function PlataformaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [config, setConfig] = useState<ConfigAdmin | null>(null);

  useEffect(() => {
    if (user && !user.isStaff) router.replace("/inicio");
  }, [user, router]);

  useEffect(() => {
    api.admin.getConfig().then(setConfig).catch(() => toast.error("Não foi possível carregar a configuração."));
  }, []);

  const guardar = async (dados: Partial<ConfigAdmin>, mensagem = "Guardado.") => {
    try {
      setConfig(await api.admin.atualizarConfig(dados));
      toast.success(mensagem);
      return true;
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar."));
      return false;
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader title="Plataforma" description="Definições globais da EYK, para todos os utilizadores." />
      {config && <AvisoManutencao config={config} guardar={guardar} />}
      <Anuncios />
      {config && <TarefasAgendadas config={config} setConfig={setConfig} guardar={guardar} />}
      <Categorias />
      {config && <Limites config={config} guardar={guardar} />}
      {config?.atualizado_por && (
        <p className="text-xs text-muted-foreground">
          Última alteração por {config.atualizado_por} {tempoRelativo(config.atualizado_em)}.
        </p>
      )}
    </div>
  );
}

type Guardar = (dados: Partial<ConfigAdmin>, mensagem?: string) => Promise<boolean>;

function AvisoManutencao({ config, guardar }: { config: ConfigAdmin; guardar: Guardar }) {
  const [mensagem, setMensagem] = useState(config.aviso_mensagem);
  const [tipo, setTipo] = useState(config.aviso_tipo);

  return (
    <section>
      <SectionHeader title="Aviso no topo da app" />
      <Card className="space-y-4 p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Wrench className="h-4 w-4" /> Mostrar aviso
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Aparece a todos (também no login), até o desligares. Quem o fecha volta a vê-lo se o mudares.
            </p>
          </div>
          <Switch
            checked={config.aviso_ativo}
            onCheckedChange={(v) =>
              void guardar({ aviso_ativo: v, aviso_mensagem: mensagem, aviso_tipo: tipo }, v ? "Aviso ativado." : "Aviso desligado.")
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["manutencao", "Manutenção"],
            ["aviso", "Aviso"],
            ["info", "Informação"],
          ] as const).map(([valor, label]) => (
            <Button key={valor} size="sm" variant={tipo === valor ? "default" : "outline"} onClick={() => setTipo(valor)}>
              {label}
            </Button>
          ))}
        </div>
        <Textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ex: A plataforma vai estar em manutenção no sábado das 22h às 23h."
        />
        <div className="flex justify-end">
          <Button
            className="gap-2"
            disabled={mensagem === config.aviso_mensagem && tipo === config.aviso_tipo}
            onClick={() => void guardar({ aviso_mensagem: mensagem, aviso_tipo: tipo }, "Aviso atualizado.")}
          >
            <Save className="h-4 w-4" /> Guardar aviso
          </Button>
        </div>
      </Card>
    </section>
  );
}

// "2026-10-16T10:00" (valor de <input type="datetime-local">, hora local).
function agoraLocal(minutosDepois = 0): string {
  const d = new Date(Date.now() + minutosDepois * 60000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function formatarDataHora(iso?: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const COR_ESTADO: Record<Anuncio["estado"], string> = {
  agendado: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  pendente: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  a_enviar: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  enviado: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  falhou: "border-red-500/40 text-red-600 dark:text-red-400",
};

function Anuncios() {
  const confirm = useConfirm();
  const [lista, setLista] = useState<Anuncio[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [link, setLink] = useState("");
  const [comEmail, setComEmail] = useState(true);
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  const carregar = useCallback(() => {
    api.admin.anuncios().then(setLista).catch(() => setLista([]));
  }, []);
  useEffect(carregar, [carregar]);

  // Enquanto houver anúncios a sair em segundo plano, atualiza o progresso.
  const emCurso = lista.some((a) => a.estado === "pendente" || a.estado === "a_enviar");
  useEffect(() => {
    if (!emCurso) return;
    const t = setInterval(carregar, 3000);
    return () => clearInterval(t);
  }, [emCurso, carregar]);

  const enviar = async () => {
    const dataAgendada = agendar && quando ? new Date(quando) : null;
    const ok = await confirm({
      title: dataAgendada ? `Agendar este anúncio para ${formatarDataHora(dataAgendada.toISOString())}?` : "Enviar este anúncio a todos?",
      description:
        (comEmail
          ? "Todos recebem a notificação na app, e quem tem \"Novidades da plataforma\" ligado recebe também um email."
          : "Todos recebem a notificação na app.") +
        (dataAgendada ? " Podes cancelar até à hora marcada." : " Não dá para desfazer."),
      confirmLabel: dataAgendada ? "Agendar anúncio" : "Enviar anúncio",
    });
    if (!ok) return;
    setAEnviar(true);
    try {
      const anuncio = await api.admin.enviarAnuncio({
        titulo,
        mensagem,
        link: link.trim(),
        enviar_email: comEmail,
        ...(dataAgendada && { agendado_para: dataAgendada.toISOString() }),
      });
      setLista((l) => [anuncio, ...l]);
      setTitulo("");
      setMensagem("");
      setLink("");
      setAgendar(false);
      setQuando("");
      if (anuncio.estado === "agendado") toast.success(`Agendado para ${formatarDataHora(anuncio.agendadoPara)}.`);
      else if (anuncio.estado === "enviado")
        toast.success(`Enviado a ${anuncio.totalDestinatarios} utilizadores (${anuncio.totalEmails} emails).`);
      else toast.success("Na fila — o envio corre em segundo plano.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o anúncio."));
    } finally {
      setAEnviar(false);
    }
  };

  const cancelar = async (a: Anuncio) => {
    const ok = await confirm({
      title: `Cancelar o anúncio "${a.titulo}"?`,
      description: "O anúncio é apagado e não chega a ser enviado.",
      confirmLabel: "Cancelar anúncio",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.admin.cancelarAnuncio(a.id);
      setLista((l) => l.filter((x) => x.id !== a.id));
      toast.success("Anúncio cancelado.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível cancelar."));
      carregar();
    }
  };

  const podeEnviar = titulo.trim() && mensagem.trim() && (!agendar || quando) && !aEnviar;

  return (
    <section>
      <SectionHeader title="Anúncios (Novidades)" />
      <Card className="space-y-4 p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="anuncio-titulo">Título</Label>
            <Input id="anuncio-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anuncio-link">Link (opcional)</Label>
            <Input id="anuncio-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/cursos/12" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="anuncio-mensagem">Mensagem</Label>
            <Textarea id="anuncio-mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={comEmail} onCheckedChange={setComEmail} /> Enviar também por email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={agendar}
              onCheckedChange={(v) => {
                setAgendar(v);
                if (v && !quando) setQuando(agoraLocal(60));
              }}
            />{" "}
            Agendar
          </label>
          {agendar && (
            <Input
              type="datetime-local"
              aria-label="Data e hora do envio"
              value={quando}
              min={agoraLocal()}
              onChange={(e) => setQuando(e.target.value)}
              className="h-9 w-auto"
            />
          )}
          <Button className="gap-2 sm:ml-auto" disabled={!podeEnviar} onClick={() => void enviar()}>
            {agendar ? <CalendarClock className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            {aEnviar ? "A enviar…" : agendar ? "Agendar" : "Enviar a todos"}
          </Button>
        </div>
      </Card>
      {lista.length > 0 && (
        <Card className="mt-4 divide-y shadow-soft">
          {lista.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.titulo}</span>
                  <Badge variant="outline" className={cn("text-[10px]", COR_ESTADO[a.estado])}>
                    {a.estado === "agendado" ? `Agendado · ${formatarDataHora(a.agendadoPara)}` : a.estadoLabel}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{a.mensagem}</p>
                <p className="text-xs text-muted-foreground">
                  {a.autor} · {tempoRelativo(a.enviadoEm || a.criadoEm)}
                  {a.estado !== "agendado" && ` · ${a.totalDestinatarios} destinatários · ${a.totalEmails} emails`}
                  {a.estado === "agendado" && (a.enviarEmail ? " · com email" : " · só na app")}
                </p>
              </div>
              {a.estado === "agendado" && (
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => void cancelar(a)}>
                  Cancelar
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function EstadoAgendador({ agendador }: { agendador: ConfigAdmin["agendador"] }) {
  const externo = agendador.modo === "imediato";
  if (externo && !agendador.ultimoCiclo) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-border/70 bg-surface/50 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Sem Celery configurado: os anúncios saem logo, mas os agendados e o lembrete automático precisam de um
        agendador — o serviço eyk-worker (plano pago) ou o workflow &quot;Agendador&quot; do GitHub Actions (plano gratuito).
      </p>
    );
  }
  if (!agendador.ativo) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {agendador.ultimoCiclo
          ? `O agendador não dá sinal ${tempoRelativo(agendador.ultimoCiclo)}. `
          : "O agendador ainda não deu sinal. "}
        {externo
          ? "Confirma que o workflow \"Agendador\" do GitHub Actions está a correr — sem ele, nada agendado é enviado."
          : "Confirma que o worker do Celery (eyk-worker) está a correr — sem ele, nada agendado é enviado."}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Agendador ativo{externo ? " (de hora a hora)" : ""} ·
      última verificação {tempoRelativo(agendador.ultimoCiclo)}
    </p>
  );
}

function TarefasAgendadas({
  config,
  setConfig,
  guardar,
}: {
  config: ConfigAdmin;
  setConfig: (c: ConfigAdmin) => void;
  guardar: Guardar;
}) {
  const confirm = useConfirm();
  const [hora, setHora] = useState(config.lembrete_ofensiva_hora);
  const [aEnviar, setAEnviar] = useState(false);

  const enviarAgora = async () => {
    const ok = await confirm({
      title: "Enviar já o lembrete de ofensiva?",
      description:
        "Vai para quem tem uma ofensiva de 3+ dias e ainda não entrou hoje. Conta como o envio de hoje: o automático já não sai hoje.",
      confirmLabel: "Enviar agora",
    });
    if (!ok) return;
    setAEnviar(true);
    try {
      setConfig(await api.admin.enviarLembreteOfensiva());
      toast.success("Lembrete enviado para a fila.");
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o lembrete."));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <section>
      <SectionHeader title="Tarefas agendadas" />
      <Card className="space-y-4 p-6 shadow-soft">
        <EstadoAgendador agendador={config.agendador} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Flame className="h-4 w-4" /> Lembrete diário de ofensiva
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Notificação (e email, para quem tem «Gamificação» ligado) a quem tem uma ofensiva de 3 ou mais dias e ainda
              não entrou hoje — antes de a perder à meia-noite.
            </p>
          </div>
          <Switch
            checked={config.lembrete_ofensiva_ativo}
            onCheckedChange={(v) => void guardar({ lembrete_ofensiva_ativo: v }, v ? "Lembrete ligado." : "Lembrete desligado.")}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="lembrete-hora">Hora do envio (hora de Angola)</Label>
            <Input
              id="lembrete-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              disabled={!config.lembrete_ofensiva_ativo}
              className="w-32"
            />
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!hora || hora === config.lembrete_ofensiva_hora}
            onClick={() => void guardar({ lembrete_ofensiva_hora: hora }, `O lembrete passa a sair às ${hora}.`)}
          >
            <Save className="h-4 w-4" /> Guardar hora
          </Button>
          <Button variant="ghost" className="gap-2 sm:ml-auto" disabled={aEnviar} onClick={() => void enviarAgora()}>
            <Send className="h-4 w-4" /> {aEnviar ? "A enviar…" : "Enviar agora"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {config.lembrete_ofensiva_ultimo_envio
            ? `Último envio ${tempoRelativo(config.lembrete_ofensiva_ultimo_envio)} (${formatarDataHora(
                config.lembrete_ofensiva_ultimo_envio,
              )}) · ${config.lembrete_ofensiva_ultimo_total} lembrete(s).`
            : "Ainda não foi enviado nenhum lembrete."}
        </p>
      </Card>
    </section>
  );
}

function Categorias() {
  const confirm = useConfirm();
  const [lista, setLista] = useState<CategoriaAdmin[] | null>(null);
  const [nova, setNova] = useState("");
  const [aEditar, setAEditar] = useState<{ id: number; nome: string } | null>(null);

  useEffect(() => {
    api.admin.categorias().then(setLista).catch(() => setLista([]));
  }, []);

  const executar = async (acao: () => Promise<CategoriaAdmin[]>, sucesso: string) => {
    try {
      setLista(await acao());
      toast.success(sucesso);
      return true;
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível concluir."));
      return false;
    }
  };

  const apagar = async (c: CategoriaAdmin) => {
    const ok = await confirm({
      title: `Apagar a categoria "${c.nome}"?`,
      description: c.totalCursos
        ? `${c.totalCursos} curso(s) ficam sem categoria (não são apagados).`
        : "Nenhum curso usa esta categoria.",
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (ok) await executar(() => api.admin.apagarCategoria(c.id), "Categoria apagada.");
  };

  return (
    <section>
      <SectionHeader title="Categorias de cursos" />
      <Card className="space-y-4 p-6 shadow-soft">
        <div className="flex gap-2">
          <Input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Nova categoria (ex: Matemática)"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nova.trim())
                void executar(() => api.admin.criarCategoria(nova.trim()), "Categoria criada.").then((ok) => ok && setNova(""));
            }}
          />
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={!nova.trim()}
            onClick={() =>
              void executar(() => api.admin.criarCategoria(nova.trim()), "Categoria criada.").then((ok) => ok && setNova(""))
            }
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {lista === null ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : lista.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Tags className="h-4 w-4" /> Ainda não há categorias.
          </p>
        ) : (
          <ul className="divide-y">
            {lista.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                {aEditar?.id === c.id ? (
                  <>
                    <Input
                      value={aEditar.nome}
                      onChange={(e) => setAEditar({ id: c.id, nome: e.target.value })}
                      className="h-9 flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Guardar"
                      onClick={() =>
                        void executar(() => api.admin.renomearCategoria(c.id, aEditar.nome.trim()), "Categoria renomeada.").then(
                          (ok) => ok && setAEditar(null),
                        )
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setAEditar(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{c.totalCursos} curso(s)</span>
                    <Button size="icon" variant="ghost" aria-label={`Renomear ${c.nome}`} onClick={() => setAEditar({ id: c.id, nome: c.nome })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Apagar ${c.nome}`} onClick={() => void apagar(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

const CAMPOS_LIMITES: { campo: keyof ConfigAdmin; label: string; ajuda: string; sufixo: string; grupo: "upload" | "moderacao" }[] = [
  { campo: "limite_video_mb", label: "Tamanho máximo de cada vídeo", ajuda: "Entre 10 e 5000 MB.", sufixo: "MB", grupo: "upload" },
  { campo: "limite_pdf_mb", label: "Tamanho máximo de cada PDF", ajuda: "Entre 1 e 500 MB.", sufixo: "MB", grupo: "upload" },
  {
    campo: "denuncias_para_ocultar",
    label: "Denúncias para ocultar automaticamente",
    ajuda: "Publicações, comentários e avaliações denunciados por este nº de pessoas ficam ocultos até um admin decidir.",
    sufixo: "denúncias",
    grupo: "moderacao",
  },
  {
    campo: "avisos_para_suspender",
    label: "Avisos até à suspensão automática",
    ajuda: "Ao chegar a este nº de avisos, a conta é suspensa e os admins são notificados.",
    sufixo: "avisos",
    grupo: "moderacao",
  },
  { campo: "dias_suspensao_automatica", label: "Duração da suspensão automática", ajuda: "Entre 1 e 365 dias.", sufixo: "dias", grupo: "moderacao" },
  {
    campo: "dias_conta_nova",
    label: "Período de conta nova",
    ajuda: "Nestes primeiros dias (ou até confirmar o email) a conta publica com metade dos limites e sem links.",
    sufixo: "dias",
    grupo: "moderacao",
  },
];

function Limites({ config, guardar }: { config: ConfigAdmin; guardar: Guardar }) {
  const [valores, setValores] = useState<Partial<Record<keyof ConfigAdmin, number>>>(() =>
    Object.fromEntries(CAMPOS_LIMITES.map(({ campo }) => [campo, config[campo] as number])),
  );
  const alterados = CAMPOS_LIMITES.some(({ campo }) => valores[campo] !== config[campo]);

  const grupo = (g: "upload" | "moderacao") =>
    CAMPOS_LIMITES.filter((c) => c.grupo === g).map(({ campo, label, ajuda, sufixo }) => (
      <div key={campo} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label htmlFor={campo} className="font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{ajuda}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={campo}
            type="number"
            value={valores[campo] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [campo]: Number(e.target.value) }))}
            className={cn("w-28", valores[campo] !== config[campo] && "border-primary")}
          />
          <span className="w-20 text-sm text-muted-foreground">{sufixo}</span>
        </div>
      </div>
    ));

  return (
    <>
      <section>
        <SectionHeader title="Limites de upload" />
        <Card className="divide-y p-6 shadow-soft">{grupo("upload")}</Card>
      </section>
      <section>
        <SectionHeader title="Moderação automática" />
        <Card className="divide-y p-6 shadow-soft">{grupo("moderacao")}</Card>
      </section>
      <div className="flex justify-end">
        <Button
          className="gap-2"
          disabled={!alterados}
          onClick={() => void guardar(valores as Partial<ConfigAdmin>, "Limites guardados.")}
        >
          {alterados ? <Upload className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          Guardar limites
        </Button>
      </div>
    </>
  );
}
