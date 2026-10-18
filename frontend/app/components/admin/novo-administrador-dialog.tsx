"use client";

import { useState, type FormEvent } from "react";
import { Crown, Mail, User, UserRound, Lock, X } from "lucide-react";
import { api, type ContaCriada, type CriarAdministradorPayload } from "@/lib/api";
import { BodyPortal } from "@/components/body-portal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

type Erros = Partial<Record<keyof CriarAdministradorPayload, string>>;

/** Formulário para um super administrador criar outro super administrador. */
export function NovoAdministradorDialog({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (conta: ContaCriada) => void;
}) {
  const [form, setForm] = useState<CriarAdministradorPayload>({
    username: "",
    email: "",
    nome: "",
    password: "",
  });
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    setErroGeral(null);
    const novos: Erros = {};
    if (!form.username.trim()) novos.username = "Obrigatório.";
    if (!form.email.trim()) novos.email = "Obrigatório.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) novos.email = "Email inválido.";
    if (form.password && form.password.length < 8) novos.password = "Mínimo de 8 caracteres.";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSubmetendo(true);
    try {
      const conta = await api.admin.criarAdministrador({
        username: form.username.trim(),
        email: form.email.trim(),
        nome: form.nome?.trim() || undefined,
        password: form.password || undefined,
      });
      onCriado(conta);
    } catch (err) {
      const data = (err as { data?: { errors?: Erros; error?: string } })?.data;
      if (data?.errors) setErros(data.errors);
      setErroGeral(data?.error || (err instanceof Error ? err.message : "Erro a criar o administrador."));
    } finally {
      setSubmetendo(false);
    }
  };

  return (
    <BodyPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="novo-admin-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submetendo) onClose();
      }}
    >
      <Card className="w-full max-w-lg shadow-2xl border-border">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 id="novo-admin-title" className="font-serif text-xl font-semibold">
                Novo super administrador
              </h2>
              <p className="text-sm text-muted-foreground">
                Terá acesso total à administração. Recebe um email com os dados de acesso.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition rounded-md p-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submeter} className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="na-username" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Nome de utilizador
              </Label>
              <Input
                id="na-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="ex: maria_admin"
                autoComplete="off"
              />
              {erros.username && <p className="text-xs text-red-400">{erros.username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="na-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="na-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@eyk.ao"
                autoComplete="off"
              />
              {erros.email && <p className="text-xs text-red-400">{erros.email}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="na-nome" className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> Nome (opcional)
              </Label>
              <Input
                id="na-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="ex: Maria Silva"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="na-password" className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Senha temporária (opcional)
              </Label>
              <PasswordInput
                id="na-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Deixa vazio para gerar uma automaticamente"
                autoComplete="new-password"
              />
              {erros.password && <p className="text-xs text-red-400">{erros.password}</p>}
              <p className="text-xs text-muted-foreground">
                No primeiro acesso a pessoa tem de escolher uma senha nova.
              </p>
            </div>
          </div>

          {erroGeral && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {erroGeral}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submetendo}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submetendo} className="gap-2">
              <Crown className="h-4 w-4" />
              {submetendo ? "A criar…" : "Criar administrador"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
    </BodyPortal>
  );
}
