"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, LogOut, MailCheck, MailWarning, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api, mensagemDeErro, tempoRelativo, type SessaoAtiva } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { useConfirm } from "@/components/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function EstadoEmail() {
  const { user, refresh } = useAuth();
  const [enviando, setEnviando] = useState(false);
  if (!user) return null;
  const verificado = user.emailVerificado !== false;

  const reenviar = async () => {
    setEnviando(true);
    try {
      const res = await api.reenviarVerificacaoEmail();
      if (res.jaVerificado) await refresh();
      else toast.success(`Enviámos um novo link para ${user.email}.`);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar o email."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {verificado ? (
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        ) : (
          <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        )}
        <div>
          <p className="font-medium">{user.email || "Sem email"}</p>
          <p className="text-sm text-muted-foreground">
            {verificado
              ? "Email confirmado — recebes alertas de segurança e podes recuperar a conta."
              : "Email por confirmar: sem isto não recebes emails nem podes descarregar certificados."}
          </p>
        </div>
      </div>
      {!verificado && (
        <Button size="sm" variant="outline" disabled={enviando} onClick={() => void reenviar()} className="shrink-0">
          {enviando ? "A enviar…" : "Reenviar link de confirmação"}
        </Button>
      )}
    </Card>
  );
}

export function SessoesAtivas() {
  const confirm = useConfirm();
  const [sessoes, setSessoes] = useState<SessaoAtiva[] | null>(null);
  const [aTerminar, setATerminar] = useState(false);

  const carregar = useCallback(() => {
    api.seguranca.sessoes().then(setSessoes).catch(() => setSessoes([]));
  }, []);
  useEffect(carregar, [carregar]);

  const terminar = async (s: SessaoAtiva) => {
    try {
      await api.seguranca.terminarSessao(s.id);
      toast.success(`Sessão terminada (${s.dispositivo}).`);
      carregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível terminar a sessão."));
    }
  };

  const terminarOutras = async () => {
    const ok = await confirm({
      title: "Terminar todas as outras sessões?",
      description: "Vais continuar com sessão iniciada só neste dispositivo.",
      confirmLabel: "Terminar outras sessões",
      destructive: true,
    });
    if (!ok) return;
    setATerminar(true);
    try {
      const res = await api.seguranca.terminarOutrasSessoes();
      toast.success(res.terminadas ? `${res.terminadas} sessão(ões) terminada(s).` : "Não havia outras sessões.");
      carregar();
    } finally {
      setATerminar(false);
    }
  };

  const outras = (sessoes || []).filter((s) => !s.atual).length;

  return (
    <Card className="space-y-4 p-6 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">Sessões ativas</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Dispositivos onde tens sessão iniciada. Se não reconheces algum (ex: um telemóvel emprestado ou um
            cibercafé), termina-o e altera a palavra-passe.
          </p>
        </div>
        {outras > 0 && (
          <Button size="sm" variant="outline" className="shrink-0 gap-2" disabled={aTerminar} onClick={() => void terminarOutras()}>
            <LogOut className="h-4 w-4" /> Terminar as outras
          </Button>
        )}
      </div>
      {sessoes === null ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <ul className="divide-y">
          {sessoes.map((s) => {
            const Icone = /Android|iPhone|iPad/.test(s.dispositivo) ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Icone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.dispositivo}
                    {s.atual && <Badge variant="outline" className="text-[10px]">Este dispositivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.ip ? `IP ${s.ip} · ` : ""}ativa {tempoRelativo(s.ultimaAtividade)}
                  </p>
                </div>
                {!s.atual && (
                  <Button size="sm" variant="ghost" onClick={() => void terminar(s)}>
                    Terminar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Gerar códigos de recuperação novos (só com o 2FA ativo). */
export function NovosCodigos2FA({ restantes }: { restantes: number | null }) {
  const [senha, setSenha] = useState("");
  const [aberto, setAberto] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [aGerar, setAGerar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const gerar = async () => {
    setAGerar(true);
    try {
      const res = await api.seguranca.novosCodigos2FA(senha);
      setCodigos(res.codigosBackup);
      setSenha("");
      setAberto(false);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível gerar os códigos."));
    } finally {
      setAGerar(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Códigos de recuperação
          </p>
          <p className="text-xs text-muted-foreground">
            {restantes === null
              ? "Para entrares se perderes o telemóvel."
              : `Tens ${restantes} código(s) por usar. Gera novos se os perdeste — os antigos deixam de funcionar.`}
          </p>
        </div>
        {!aberto && !codigos && (
          <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
            Gerar novos códigos
          </Button>
        )}
      </div>

      {aberto && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="senha-codigos">Confirma com a tua palavra-passe</Label>
            <PasswordInput id="senha-codigos" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!senha || aGerar} onClick={() => void gerar()}>
              {aGerar ? "A gerar…" : "Gerar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {codigos && (
        <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">Guarda estes códigos — cada um só pode ser usado uma vez.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            {codigos.map((c) => (
              <span key={c} className="rounded bg-surface px-2 py-1">{c}</span>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              void navigator.clipboard?.writeText(codigos.join("\n"));
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar códigos"}
          </Button>
        </div>
      )}
    </div>
  );
}
