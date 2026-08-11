"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Search,
  User,
  Users,
  Mail,
  Lock,
  BookOpenText,
  Briefcase,
  UserCheck,
  Clock,
  CircleDot,
  X,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";
import {
  api,
  type AdminProfessor,
  type CriarProfessorPayload,
} from "@/lib/api";
import { PageHeader } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-gate";

type Toast = {
  tipo: "sucesso" | "erro" | "aviso";
  msg: string;
};

function ToastBar({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cores = {
    sucesso:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
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
    return d.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function AdminProfessoresPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [professores, setProfessores] = useState<AdminProfessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"todos" | "ativos" | "pendentes">("todos");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [submetendo, setSubmetendo] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CriarProfessorPayload, string>>
  >({});

  const [form, setForm] = useState<CriarProfessorPayload>({
    username: "",
    email: "",
    password: "",
    nome_publico: "",
    area: "",
  });

  // === Bloqueio para nãos-staff ===
  useEffect(() => {
    if (!user) return;
    if (!user.isStaff) {
      router.replace("/");
    }
  }, [user, router]);

  // === Carregar lista ===
  const carregar = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getProfessores();
      setProfessores(res);
    } catch (err) {
      setToast({
        tipo: "erro",
        msg: err instanceof Error ? err.message : "Erro a carregar professores.",
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    carregar();
  }, []);

  const abrirModal = () => {
    setForm({ username: "", email: "", password: "", nome_publico: "", area: "" });
    setFormErrors({});
    setModalAberto(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const erros: typeof formErrors = {};
    if (!form.username.trim()) erros.username = "Obrigatório.";
    if (!form.email.trim()) erros.email = "Obrigatório.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      erros.email = "Email inválido.";
    if (!form.password || form.password.length < 6)
      erros.password = "Mínimo de 6 caracteres.";
    if (!form.nome_publico.trim()) erros.nome_publico = "Obrigatório.";
    if (!form.area.trim()) erros.area = "Obrigatória.";
    if (Object.keys(erros).length) {
      setFormErrors(erros);
      return;
    }
    setSubmetendo(true);
    try {
      await api.admin.criarProfessor(form);
      setToast({
        tipo: "sucesso",
        msg: `Professor "${form.username}" registado com sucesso.`,
      });
      setModalAberto(false);
      carregar();
    } catch (err) {
      // Tentar extrair erros por campo do Django (400)
      try {
        // @ts-expect-error err.response pode existir
        const resp = err?.response;
        if (resp) {
          const json = await resp.json();
          if (json?.errors && typeof json.errors === "object") {
            setFormErrors(json.errors as typeof formErrors);
            setToast({ tipo: "aviso", msg: "Verifica os campos assinalados." });
          } else if (json?.error) {
            setToast({ tipo: "erro", msg: json.error as string });
          } else {
            setToast({ tipo: "erro", msg: err instanceof Error ? err.message : "Erro." });
          }
        } else {
          setToast({
            tipo: "erro",
            msg: err instanceof Error ? err.message : "Erro a registar professor.",
          });
        }
      } catch {
        setToast({
          tipo: "erro",
          msg: err instanceof Error ? err.message : "Erro a registar professor.",
        });
      }
    } finally {
      setSubmetendo(false);
    }
  };

  // === Filtros ===
  const filtrados = professores.filter((p) => {
    if (tab === "ativos" && !p.ativo) return false;
    if (tab === "pendentes" && p.user.perfil_completo) return false;
    if (q) {
      const qq = q.toLowerCase();
      return (
        p.nome_publico.toLowerCase().includes(qq) ||
        p.area.toLowerCase().includes(qq) ||
        p.user.username.toLowerCase().includes(qq) ||
        p.user.email.toLowerCase().includes(qq)
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Professores"
        description="Regista novos professores e visualiza a lista completa da equipa."
      >
        <Button onClick={abrirModal} className="gap-2 bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold">
          <UserPlus className="h-4 w-4" />
          Registar professor
        </Button>
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
              <p className="text-2xl font-serif font-semibold">{professores.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Perfis completos</p>
              <p className="text-2xl font-serif font-semibold">
                {professores.filter((p) => p.user.perfil_completo).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pendentes</p>
              <p className="text-2xl font-serif font-semibold">
                {professores.filter((p) => !p.user.perfil_completo).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Filtros + tabela ===== */}
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="bg-surface">
              <TabsTrigger value="todos">Todos ({professores.length})</TabsTrigger>
              <TabsTrigger value="ativos">Ativos ({professores.filter((p) => p.ativo).length})</TabsTrigger>
              <TabsTrigger value="pendentes">
                Pendentes ({professores.filter((p) => !p.user.perfil_completo).length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, utilizador, email ou área…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <CircleDot className="mx-auto h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-3 text-sm">A carregar lista de professores…</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-surface/60">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mt-4 font-serif text-lg">
              {professores.length === 0
                ? "Nenhum professor registado ainda."
                : "Nenhum professor corresponde aos filtros."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {professores.length === 0
                ? "Clica em “Registar professor” para começares."
                : "Tenta uma pesquisa diferente."}
            </p>
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Professor</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Área</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden sm:table-cell">Utilizador</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden md:table-cell">Email</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap">Perfil</th>
                  <th className="text-left font-medium py-2 pr-4 whitespace-nowrap hidden sm:table-cell">Registado em</th>
                  <th className="text-left font-medium py-2 whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className="group">
                    <td className="first:rounded-l-xl last:rounded-r-xl py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-gold text-primary-foreground font-serif font-bold">
                            {initialsOf(p.nome_publico)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{p.nome_publico}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">@{p.user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        <Briefcase className="h-3 w-3 mr-1" /> {p.area}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden sm:table-cell whitespace-nowrap">
                      <span className="font-mono text-xs text-muted-foreground">@{p.user.username}</span>
                    </td>
                    <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden md:table-cell whitespace-nowrap">
                      <span className="text-sm">{p.user.email}</span>
                    </td>
                    <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                      {p.user.perfil_completo ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
                          <UserCheck className="h-3 w-3 mr-1" /> Completo
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/20">
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 hidden sm:table-cell whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">{fmtDate(p.user.date_joined)}</span>
                    </td>
                    <td className="first:rounded-l-xl last:rounded-r-xl py-3 bg-surface/40 group-hover:bg-surface/70 transition border-y border-y-transparent group-hover:border-y-border/50 whitespace-nowrap">
                      {p.ativo ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/20">
                          Inativo
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== Modal registar professor ===== */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalAberto(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-prof-title"
        >
          <Card className="w-full max-w-lg shadow-2xl border-border animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="reg-prof-title" className="font-serif text-xl font-semibold">Registar novo professor</h2>
                  <p className="text-sm text-muted-foreground">
                    Será enviado um convite implícito — o professor completa o perfil no primeiro login.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="text-muted-foreground hover:text-foreground transition rounded-md p-1"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="rp-username" className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Nome de utilizador
                  </Label>
                  <Input
                    id="rp-username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="ex: ana_silva"
                    className={formErrors.username ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}
                  />
                  {formErrors.username && <p className="text-xs text-red-400">{formErrors.username}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="rp-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Label>
                  <Input
                    id="rp-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="professor@eyk.ao"
                    className={formErrors.email ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}
                  />
                  {formErrors.email && <p className="text-xs text-red-400">{formErrors.email}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="rp-password" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Senha temporária
                  </Label>
                  <PasswordInput
                    id="rp-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres — partilha com o professor."
                    className={formErrors.password ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}
                  />
                  {formErrors.password && <p className="text-xs text-red-400">{formErrors.password}</p>}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="rp-nome" className="flex items-center gap-1.5">
                    <BookOpenText className="h-3.5 w-3.5" /> Nome público
                  </Label>
                  <Input
                    id="rp-nome"
                    value={form.nome_publico}
                    onChange={(e) => setForm({ ...form, nome_publico: e.target.value })}
                    placeholder="ex: Prof.ª Ana Silva"
                    className={formErrors.nome_publico ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}
                  />
                  {formErrors.nome_publico && (
                    <p className="text-xs text-red-400">{formErrors.nome_publico}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="rp-area" className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Área de atuação
                  </Label>
                  <Input
                    id="rp-area"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    placeholder="ex: Matemática, Programação…"
                    className={formErrors.area ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}
                  />
                  {formErrors.area && <p className="text-xs text-red-400">{formErrors.area}</p>}
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAberto(false)}
                  disabled={submetendo}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-gold text-primary-foreground hover:opacity-95 shadow-gold gap-2"
                  disabled={submetendo}
                >
                  <UserPlus className="h-4 w-4" />
                  {submetendo ? "A registar…" : "Registar professor"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
