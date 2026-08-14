"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { User, Bell, Shield, Palette, Save, ShieldCheck, ShieldOff, Trash2, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-gate";
import { useTheme } from "@/components/theme-provider";
import { api, API_BASE_URL } from "@/lib/api";

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveButton({ state, onClick, label = "Guardar alterações" }: { state: SaveState; onClick: () => void; label?: string }) {
  return (
    <Button onClick={onClick} disabled={state === "saving"} className="gap-2">
      <Save className="h-4 w-4" />
      {state === "saving" ? "A guardar…" : state === "saved" ? "Guardado ✓" : state === "error" ? "Erro — tenta de novo" : label}
    </Button>
  );
}

export default function ConfiguracoesPage() {
  const { user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("perfil");

  const isTeacher = Boolean(user?.isTeacher);

  // ── Perfil ────────────────────────────────────────────────────────────────
  const [bio, setBio] = useState(user?.bio || "");
  const [nomePublico, setNomePublico] = useState(user?.name || "");
  const [perfilState, setPerfilState] = useState<SaveState>("idle");

  useEffect(() => {
    setBio(user?.bio || "");
    setNomePublico(user?.name || "");
  }, [user?.bio, user?.name]);

  const guardarPerfil = async () => {
    setPerfilState("saving");
    try {
      if (isTeacher) {
        await api.professor.atualizarPerfil({ bio, nome_publico: nomePublico });
      } else {
        await api.perfil.atualizarAluno(bio);
      }
      await refresh();
      setPerfilState("saved");
    } catch {
      setPerfilState("error");
    } finally {
      setTimeout(() => setPerfilState("idle"), 2500);
    }
  };

  // ── Notificações ──────────────────────────────────────────────────────────
  const [notifNovidades, setNotifNovidades] = useState(user?.notifEmailNovidades ?? true);
  const [notifComunidade, setNotifComunidade] = useState(user?.notifEmailComunidade ?? true);
  const [notifGamificacao, setNotifGamificacao] = useState(user?.notifEmailGamificacao ?? true);
  const [notifState, setNotifState] = useState<SaveState>("idle");

  useEffect(() => {
    setNotifNovidades(user?.notifEmailNovidades ?? true);
    setNotifComunidade(user?.notifEmailComunidade ?? true);
    setNotifGamificacao(user?.notifEmailGamificacao ?? true);
  }, [user?.notifEmailNovidades, user?.notifEmailComunidade, user?.notifEmailGamificacao]);

  const guardarNotificacoes = async (overrides?: Partial<{ novidades: boolean; comunidade: boolean; gamificacao: boolean }>) => {
    setNotifState("saving");
    try {
      await api.preferencias.atualizar({
        notif_email_novidades: overrides?.novidades ?? notifNovidades,
        notif_email_comunidade: overrides?.comunidade ?? notifComunidade,
        notif_email_gamificacao: overrides?.gamificacao ?? notifGamificacao,
      });
      setNotifState("saved");
    } catch {
      setNotifState("error");
    } finally {
      setTimeout(() => setNotifState("idle"), 2000);
    }
  };

  // ── Aparência ─────────────────────────────────────────────────────────────
  const alternarTema = async (escuro: boolean) => {
    setTheme(escuro ? "dark" : "light");
    try {
      await api.preferencias.atualizar({ tema_preferido: escuro ? "escuro" : "claro" });
    } catch {
      /* a UI já mudou localmente; falha silenciosa na persistência */
    }
  };

  // ── Segurança: palavra-passe ──────────────────────────────────────────────
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirmar, setSenhaConfirmar] = useState("");
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaState, setSenhaState] = useState<SaveState>("idle");

  const alterarSenha = async () => {
    setSenhaErro(null);
    if (senhaNova.length < 8) {
      setSenhaErro("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senhaNova !== senhaConfirmar) {
      setSenhaErro("As palavras-passe não coincidem.");
      return;
    }
    setSenhaState("saving");
    try {
      const res = await api.seguranca.alterarSenha(senhaAtual, senhaNova);
      if (!res.ok) {
        setSenhaErro(res.error || "Não foi possível alterar a palavra-passe.");
        setSenhaState("error");
        return;
      }
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaConfirmar("");
      setSenhaState("saved");
    } catch (err) {
      setSenhaErro(err instanceof Error ? err.message : "Erro ao alterar a palavra-passe.");
      setSenhaState("error");
    } finally {
      setTimeout(() => setSenhaState("idle"), 2500);
    }
  };

  // ── Segurança: 2FA ────────────────────────────────────────────────────────
  const [tem2FA, setTem2FA] = useState<boolean | null>(null);
  const [setup2FA, setSetup2FA] = useState<{ qrBase64: string; secret: string } | null>(null);
  const [codigo2FA, setCodigo2FA] = useState("");
  const [erro2FA, setErro2FA] = useState<string | null>(null);
  const [codigosBackup, setCodigosBackup] = useState<string[] | null>(null);
  const [loading2FA, setLoading2FA] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api.seguranca.status2FA().then((r) => setTem2FA(r.ativo)).catch(() => setTem2FA(false));
  }, []);

  const iniciar2FA = async () => {
    setErro2FA(null);
    setLoading2FA(true);
    try {
      const res = await api.seguranca.iniciar2FA();
      if (!res.ok) {
        setErro2FA(res.error || "Não foi possível iniciar a configuração.");
        return;
      }
      setSetup2FA({ qrBase64: res.qrBase64, secret: res.secret });
    } finally {
      setLoading2FA(false);
    }
  };

  const confirmar2FA = async () => {
    setErro2FA(null);
    setLoading2FA(true);
    try {
      const res = await api.seguranca.confirmar2FA(codigo2FA.trim());
      if (!res.ok) {
        setErro2FA(res.error || "Código inválido.");
        return;
      }
      setCodigosBackup(res.codigosBackup || []);
      setSetup2FA(null);
      setCodigo2FA("");
      setTem2FA(true);
    } finally {
      setLoading2FA(false);
    }
  };

  const desativar2FA = async () => {
    if (!window.confirm("Desativar a autenticação de dois fatores? A tua conta ficará menos protegida.")) return;
    setLoading2FA(true);
    try {
      await api.seguranca.desativar2FA();
      setTem2FA(false);
      setCodigosBackup(null);
    } finally {
      setLoading2FA(false);
    }
  };

  // ── Zona de perigo: apagar conta ─────────────────────────────────────────
  const [apagando, setApagando] = useState(false);
  const apagarConta = async () => {
    const confirmacao = window.prompt(
      'Esta ação é irreversível e apaga permanentemente a tua conta. Escreve "APAGAR" para confirmar.',
    );
    if (confirmacao !== "APAGAR") return;
    setApagando(true);
    try {
      if (isTeacher) {
        await api.professor.apagarConta();
      } else {
        await api.perfil.apagarContaAluno();
      }
      window.location.assign(API_BASE_URL + "/");
    } catch {
      setApagando(false);
      window.alert("Não foi possível apagar a conta. Tenta novamente.");
    }
  };

  const initials = user?.initials || "?";
  const name = user?.name || "Utilizador";
  const level = user?.level ?? 1;
  const coins = user?.coins ?? 0;
  const email = user?.email || "";

  return (
    <div className="space-y-8">
      <PageHeader title="Configurações" description="Personaliza a tua experiência na plataforma EYK." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-surface">
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2">
            <Shield className="h-4 w-4" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="gap-2">
            <Palette className="h-4 w-4" /> Aparência
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* ═══════════════ PERFIL ═══════════════ */}
          <TabsContent value="perfil" className="space-y-5">
            <Card className="p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <Avatar className="h-24 w-24 shadow-md">
                  <AvatarFallback className="text-3xl bg-gradient-gold text-primary-foreground font-serif font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <p className="font-serif text-2xl font-semibold">{name}</p>
                  {!isTeacher && (
                    <Badge variant="outline" className="text-xs">
                      Nível {level} · {coins} moedas
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-soft grid gap-5 sm:grid-cols-2">
              {isTeacher && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome público</Label>
                  <Input id="nome" value={nomePublico} onChange={(e) => setNomePublico(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} disabled readOnly />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <SaveButton state={perfilState} onClick={() => void guardarPerfil()} />
              </div>
            </Card>
          </TabsContent>

          {/* ═══════════════ NOTIFICAÇÕES ═══════════════ */}
          <TabsContent value="notificacoes" className="space-y-5">
            <Card className="p-6 shadow-soft divide-y">
              {[
                { key: "novidades", label: "Novidades da plataforma", desc: "Emails sobre atualizações e lançamentos.", value: notifNovidades, set: setNotifNovidades },
                { key: "comunidade", label: "Emails da comunidade", desc: "Recebe emails quando alguém interage com os teus posts.", value: notifComunidade, set: setNotifComunidade },
                { key: "gamificacao", label: "Gamificação", desc: "Conquistas, moedas e lembretes de streak.", value: notifGamificacao, set: setNotifGamificacao },
              ].map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{row.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{row.desc}</p>
                  </div>
                  <Switch
                    checked={row.value}
                    onCheckedChange={(v) => {
                      row.set(v);
                      void guardarNotificacoes({ [row.key]: v } as Record<string, boolean>);
                    }}
                  />
                </div>
              ))}
              {notifState === "saved" && (
                <p className="pt-3 text-xs text-emerald-500">Preferências guardadas.</p>
              )}
            </Card>
          </TabsContent>

          {/* ═══════════════ SEGURANÇA ═══════════════ */}
          <TabsContent value="seguranca" className="space-y-5">
            <Card className="p-6 shadow-soft grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="senha-atual">Palavra-passe atual</Label>
                <PasswordInput id="senha-atual" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha-nova">Nova palavra-passe</Label>
                <PasswordInput id="senha-nova" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha-confirmar">Confirmar nova</Label>
                <PasswordInput id="senha-confirmar" value={senhaConfirmar} onChange={(e) => setSenhaConfirmar(e.target.value)} />
              </div>
              {senhaErro && <p className="sm:col-span-2 text-sm text-red-400">{senhaErro}</p>}
              <div className="sm:col-span-2 flex justify-end">
                <SaveButton state={senhaState} onClick={() => void alterarSenha()} label="Alterar palavra-passe" />
              </div>
            </Card>

            <Card className="p-6 shadow-soft space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-medium">Autenticação de dois fatores (2FA)</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Camada extra de segurança ao entrares na tua conta.
                  </p>
                </div>
                {tem2FA === null ? (
                  <Badge variant="outline" className="w-fit">A verificar…</Badge>
                ) : tem2FA ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 w-fit gap-1">
                      <ShieldCheck className="h-3 w-3" /> Ativo
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => void desativar2FA()} disabled={loading2FA} className="gap-2">
                      <ShieldOff className="h-4 w-4" /> Desativar
                    </Button>
                  </div>
                ) : (
                  !setup2FA && (
                    <Button size="sm" onClick={() => void iniciar2FA()} disabled={loading2FA} className="gap-2">
                      <ShieldCheck className="h-4 w-4" /> Ativar 2FA
                    </Button>
                  )
                )}
              </div>

              {setup2FA && (
                <div className="rounded-xl border border-border/70 p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Digitaliza o código QR com a tua app de autenticação (Google Authenticator, Authy, …) e introduz o código gerado.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <Image
                      src={`data:image/png;base64,${setup2FA.qrBase64}`}
                      alt="Código QR para configurar 2FA"
                      width={160}
                      height={160}
                      unoptimized
                      className="h-40 w-40 rounded-lg border border-border/70 bg-white p-2"
                    />
                    <div className="flex-1 space-y-3 min-w-0">
                      <div>
                        <Label className="text-xs text-muted-foreground">Chave manual</Label>
                        <p className="font-mono text-xs break-all">{setup2FA.secret}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigo-2fa">Código de 6 dígitos</Label>
                        <Input
                          id="codigo-2fa"
                          value={codigo2FA}
                          onChange={(e) => setCodigo2FA(e.target.value)}
                          placeholder="000000"
                          maxLength={6}
                        />
                      </div>
                      {erro2FA && <p className="text-sm text-red-400">{erro2FA}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void confirmar2FA()} disabled={loading2FA || codigo2FA.length < 6}>
                          Confirmar e ativar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSetup2FA(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {codigosBackup && codigosBackup.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-sm font-medium">
                    Guarda estes códigos de recuperação — cada um só pode ser usado uma vez.
                  </p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    {codigosBackup.map((c) => (
                      <span key={c} className="rounded bg-surface px-2 py-1">{c}</span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      navigator.clipboard?.writeText(codigosBackup.join("\n"));
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2000);
                    }}
                  >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? "Copiado" : "Copiar códigos"}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-6 shadow-soft border-red-500/30 space-y-3">
              <p className="font-medium text-red-400">Zona de perigo</p>
              <p className="text-sm text-muted-foreground">
                Apagar a tua conta é permanente e remove todos os teus dados da plataforma.
              </p>
              <Button variant="outline" className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-400 w-fit" onClick={() => void apagarConta()} disabled={apagando}>
                <Trash2 className="h-4 w-4" />
                {apagando ? "A apagar…" : "Apagar a minha conta"}
              </Button>
            </Card>
          </TabsContent>

          {/* ═══════════════ APARÊNCIA ═══════════════ */}
          <TabsContent value="aparencia" className="space-y-5">
            <Card className="p-6 shadow-soft divide-y">
              <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">Modo escuro</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Alterna entre o tema claro e escuro da plataforma.</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={(v) => void alternarTema(v)} />
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
