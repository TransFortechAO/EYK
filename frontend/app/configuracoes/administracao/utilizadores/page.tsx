"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  UserCog,
  CircleDot,
  X,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  UserCheck,
  UserX,
  Filter,
  Coins,
  Crown,
  GraduationCap,
  Briefcase,
  ChevronDown,
  Gavel,
} from "lucide-react";
import {
  api,
  type AdminUser,
  type AdminUserTipoFiltro,
} from "@/lib/api";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/components/auth-gate";
import { BodyPortal } from "@/components/body-portal";
import { DialogoDecisao, type Decisao } from "@/components/moderacao/dialogo-decisao";
import { NovoAdministradorDialog } from "@/components/admin/novo-administrador-dialog";
import { CredenciaisDialog } from "@/components/admin/credenciais-dialog";

type Toast = { tipo: "sucesso" | "erro" | "aviso"; msg: string };

const TIPOS: { value: AdminUserTipoFiltro; label: string; icon: typeof GraduationCap }[] = [
  { value: "", label: "Todos os tipos", icon: Filter },
  { value: "aluno", label: "Alunos", icon: GraduationCap },
  { value: "professor", label: "Professores", icon: Briefcase },
  { value: "staff", label: "Administradores", icon: Crown },
];

function ToastBar({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cores = {
    sucesso: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    erro: "border-red-500/40 bg-red-500/10 text-red-200",
    aviso: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  } as const;
  const Icon = toast.tipo === "sucesso" ? CheckCircle2 : AlertTriangle;
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose, toast]);
  return (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur ${cores[toast.tipo]}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="text-sm font-medium flex-1">{toast.msg}</p>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function initialsOf(name: string): string {
  const p = (name || "U").trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return p[0].slice(0, 2).toUpperCase();
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

export default function AdminUtilizadoresPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<AdminUserTipoFiltro>("");
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [apagar, setApagar] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [operando, setOperando] = useState<number | null>(null);
  const [aModerar, setAModerar] = useState<AdminUser | null>(null);
  const [novoAdminAberto, setNovoAdminAberto] = useState(false);
  const [credenciais, setCredenciais] = useState<{
    username: string;
    email: string;
    senha: string;
  } | null>(null);

  useEffect(() => {
    if (authUser && !authUser.isStaff) router.replace("/inicio");
  }, [authUser, router]);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getUtilizadores({ q, tipo });
      setUsers(res);
    } catch (err) {
      setToast({
        tipo: "erro",
        msg: err instanceof Error ? err.message : "Erro a carregar utilizadores.",
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tipo]);

  // Fecha dropdown de ações ao clicar fora
  useEffect(() => {
    if (!menuAberto) return;
    const onDown = () => setMenuAberto(null);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuAberto]);

  const stats = useMemo(() => {
    const total = users.length;
    const ativos = users.filter((u) => u.is_active).length;
    const admins = users.filter((u) => u.is_staff).length;
    return { total, ativos, admins };
  }, [users]);

  const bloquearAcao = (u: AdminUser) => {
    if (!authUser) return true;
    if (u.id === authUser.id) return true; // a própria conta
    if (u.is_staff || u.is_superuser) return true; // outros admins
    return false;
  };

  const handleToggle = async (u: AdminUser) => {
    if (bloquearAcao(u)) return;
    setOperando(u.id);
    try {
      const res = await api.admin.toggleAtivoUtilizador(u.id);
      setToast({ tipo: "sucesso", msg: res.message });
      setUsers((lista) =>
        lista.map((x) => (x.id === u.id ? { ...x, is_active: res.is_active } : x)),
      );
    } catch (err) {
      setToast({
        tipo: "erro",
        msg: err instanceof Error ? err.message : "Erro a alterar estado da conta.",
      });
    } finally {
      setOperando(null);
      setMenuAberto(null);
    }
  };

  const aplicarSancao = async (u: AdminUser, d: Decisao): Promise<boolean> => {
    if (!d.sancao) return false;
    try {
      const res = await api.admin.sancionar(u.id, d.sancao, d.motivo, d.dias);
      const h = res.utilizador;
      setUsers((lista) =>
        lista.map((x) =>
          x.id === u.id ? { ...x, banido: h.banido, suspenso_ate: h.suspensoAte, motivo_sancao: d.motivo } : x,
        ),
      );
      const mensagens = {
        aviso: "Aviso enviado.",
        suspensao: `Conta suspensa durante ${d.dias} dia(s).`,
        banimento: "Conta banida.",
        levantar: "Sanção levantada.",
      } as const;
      setToast({ tipo: "sucesso", msg: mensagens[d.sancao] });
      return true;
    } catch (err) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail;
      setToast({ tipo: "erro", msg: msg || "Não foi possível aplicar a sanção." });
      return false;
    }
  };

  const confirmarApagar = async () => {
    if (!apagar) return;
    setOperando(apagar.id);
    try {
      const res = await api.admin.apagarUtilizador(apagar.id);
      setToast({ tipo: "sucesso", msg: res.message });
      setUsers((lista) => lista.filter((x) => x.id !== apagar.id));
      setApagar(null);
    } catch (err) {
      setToast({
        tipo: "erro",
        msg: err instanceof Error ? err.message : "Erro a apagar conta.",
      });
    } finally {
      setOperando(null);
    }
  };

  return (
    <div className="space-y-8">
      {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Utilizadores"
        description="Pesquisa, filtra e gere contas de toda a plataforma."
      >
        {authUser?.isSuperuser && (
          <Button onClick={() => setNovoAdminAberto(true)} className="gap-2">
            <Crown className="h-4 w-4" />
            Novo administrador
          </Button>
        )}
      </PageHeader>

      {/* ===== Estatísticas ===== */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-serif font-semibold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ativos</p>
              <p className="text-2xl font-serif font-semibold">{stats.ativos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/15 text-purple-300">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Administradores</p>
              <p className="text-2xl font-serif font-semibold">{stats.admins}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Filtros ===== */}
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome de utilizador ou email…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="relative w-full lg:w-64">
            <button
              type="button"
              onClick={() => setMenuAberto(menuAberto === "__tipos" ? null : "__tipos")}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface/80 transition"
            >
              <span className="flex items-center gap-2 truncate">
                {(() => {
                  const t = TIPOS.find((x) => x.value === tipo) ?? TIPOS[0];
                  const IconC = t.icon;
                  return (
                    <>
                      <IconC className="h-4 w-4 text-amber-300" />
                      <span className="truncate">{t.label}</span>
                    </>
                  );
                })()}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            {menuAberto === "__tipos" && (
              <div
                className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-popover shadow-2xl p-1 text-sm"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {TIPOS.map((t) => (
                  <button
                    key={t.value || "_all"}
                    onClick={() => {
                      setTipo(t.value);
                      setMenuAberto(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition ${
                      tipo === t.value
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" onClick={carregar} className="lg:w-auto">
            <UserCog className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        {/* ===== Tabela ===== */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <CircleDot className="mx-auto h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-3 text-sm">A carregar lista de utilizadores…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface/60">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 font-serif text-lg">Nenhum utilizador encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Altera os filtros ou limpa a pesquisa.
            </p>
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Utilizador</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden md:table-cell">Email</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Tipo</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden lg:table-cell">Moedas</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden sm:table-cell">
                    Registado
                  </th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Estado</th>
                  <th className="text-right font-medium py-2 whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const bloqueado = bloquearAcao(u);
                  return (
                    <tr key={u.id} className="group">
                      <td className="first:rounded-l-xl last:rounded-r-xl py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <UserAvatar noLink name={u.username} initials={initialsOf(u.username)} userId={u.id} size={36} />
                          </Avatar>
                          <div>
                            <p className="font-medium leading-tight">{u.username}</p>
                            <p className="text-xs text-muted-foreground md:hidden">{u.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden md:table-cell whitespace-nowrap">
                        <span className="text-sm">{u.email || "—"}</span>
                      </td>
                      <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {u.is_staff && (
                            <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 text-[11px]">
                              <Crown className="h-3 w-3 mr-1" /> Admin
                            </Badge>
                          )}
                          {u.is_teacher && (
                            <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/20 text-[11px]">
                              <Briefcase className="h-3 w-3 mr-1" /> Professor
                            </Badge>
                          )}
                          {u.is_student && (
                            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-[11px]">
                              <GraduationCap className="h-3 w-3 mr-1" /> Aluno
                            </Badge>
                          )}
                          {!u.is_staff && !u.is_teacher && !u.is_student && (
                            <Badge variant="outline" className="text-[11px]">Sem tipo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden lg:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Coins className="h-3.5 w-3.5 text-amber-300" />
                          {u.coins.toLocaleString("pt-PT")}
                        </span>
                      </td>
                      <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden sm:table-cell whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">{fmtDate(u.date_joined)}</span>
                      </td>
                      <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                        {u.banido ? (
                          <Badge className="bg-red-500/15 text-red-300 border-red-500/30" title={u.motivo_sancao}>
                            Banido
                          </Badge>
                        ) : u.suspenso_ate ? (
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30" title={u.motivo_sancao}>
                            Suspenso até {fmtDate(u.suspenso_ate)}
                          </Badge>
                        ) : u.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/20">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="first:rounded-l-xl last:rounded-r-xl py-3 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap text-right relative">
                        {bloqueado ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                            title={
                              u.id === authUser?.id
                                ? "Não podes gerir a tua própria conta por aqui."
                                : "Conta de administrador protegida."
                            }
                          >
                            <ShieldAlert className="h-3.5 w-3.5" /> Protegida
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuAberto(menuAberto === String(u.id) ? null : String(u.id));
                              }}
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs border border-border hover:bg-accent hover:text-accent-foreground transition"
                              disabled={operando === u.id}
                            >
                              {operando === u.id ? (
                                <CircleDot className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCog className="h-3.5 w-3.5" />
                              )}
                              Gerir
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            {menuAberto === String(u.id) && (
                              <div
                                className="absolute right-0 z-40 mt-1 min-w-[180px] rounded-lg border border-border bg-popover shadow-2xl p-1 text-sm"
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleToggle(u)}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent hover:text-accent-foreground transition"
                                >
                                  {u.is_active ? (
                                    <>
                                      <UserX className="h-4 w-4 text-amber-300" /> Desativar conta
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 text-emerald-300" /> Ativar conta
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setAModerar(u);
                                    setMenuAberto(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-accent hover:text-accent-foreground transition"
                                >
                                  <Gavel className="h-4 w-4 text-amber-300" /> Avisar, suspender ou banir…
                                </button>
                                <button
                                  onClick={() => {
                                    setApagar(u);
                                    setMenuAberto(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-destructive hover:bg-destructive/10 transition"
                                >
                                  <Trash2 className="h-4 w-4" /> Apagar conta
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {aModerar && (
        <DialogoDecisao
          open
          onOpenChange={(aberto) => !aberto && setAModerar(null)}
          titulo={`Moderar ${aModerar.username}`}
          descricao="O utilizador recebe o motivo por email, com um link para contestar."
          sancionado={aModerar.banido || Boolean(aModerar.suspenso_ate)}
          onConfirmar={(d) => aplicarSancao(aModerar, d)}
        />
      )}

      {/* ===== Modal confirmar apagar ===== */}
      {apagar && (
        <BodyPortal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && operando !== apagar.id) setApagar(null);
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="del-title"
          aria-describedby="del-desc"
        >
          <Card className="w-full max-w-md shadow-2xl border-destructive/40">
            <div className="flex flex-col items-center text-center p-6 border-b border-border">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-300 mb-4">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 id="del-title" className="font-serif text-xl font-semibold">
                Apagar conta de &quot;{apagar.username}&quot;?
              </h3>
              <p id="del-desc" className="text-sm text-muted-foreground mt-2 max-w-sm">
                Esta ação é permanente. Todos os dados associados a esta conta (posts, comentários, reações, progresso, moedas) serão removidos e não podem ser recuperados.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setApagar(null)} disabled={operando === apagar.id}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmarApagar}
                disabled={operando === apagar.id}
                className="gap-2"
              >
                {operando === apagar.id ? (
                  <>
                    <CircleDot className="h-4 w-4 animate-spin" /> A apagar…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Sim, apagar conta
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
        </BodyPortal>
      )}

      {novoAdminAberto && (
        <NovoAdministradorDialog
          onClose={() => setNovoAdminAberto(false)}
          onCriado={(conta) => {
            setNovoAdminAberto(false);
            carregar();
            if (conta.email_enviado) {
              setToast({
                tipo: "sucesso",
                msg: `Administrador "${conta.username}" criado. Enviámos um email com os dados de acesso.`,
              });
            } else if (conta.senha_temporaria) {
              setCredenciais({
                username: conta.username,
                email: conta.email,
                senha: conta.senha_temporaria,
              });
            }
          }}
        />
      )}

      {credenciais && (
        <CredenciaisDialog
          username={credenciais.username}
          email={credenciais.email}
          senha={credenciais.senha}
          onClose={() => setCredenciais(null)}
        />
      )}
    </div>
  );
}
