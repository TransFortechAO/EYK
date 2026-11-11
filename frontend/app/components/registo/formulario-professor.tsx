"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, mensagemDeErro } from "@/lib/api";
import { AuthAlert, AuthSpinner, authButtonClass, authInputClass } from "@/components/auth-shell";

const textareaClass = `${authInputClass} h-auto min-h-[110px] py-3`;

/**
 * Pedido para ser professor (separador "Professor" do registo). Não cria logo a conta:
 * enviamos um email para confirmar o endereço e escolher a palavra-passe.
 */
export function FormularioProfessor() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [area, setArea] = useState("");
  const [apresentacao, setApresentacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dados = () => ({
    nome: nome.trim(),
    email: email.trim(),
    telefone: telefone.trim() || undefined,
    area: area.trim() || undefined,
    apresentacao: apresentacao.trim() || undefined,
  });

  const enviar = () => {
    setErro(null);
    setAviso(null);
    if (nome.trim().length < 3) {
      setErro("Indica o teu nome completo.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErro("Introduz um email válido.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await api.enviarCandidaturaProfessor(dados());
        setEnviadoPara(res.email);
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível enviar o pedido. Tenta novamente."));
      }
    });
  };

  const reenviar = () => {
    setAviso(null);
    setErro(null);
    startTransition(async () => {
      try {
        await api.enviarCandidaturaProfessor(dados());
        setAviso("Enviámos o email outra vez.");
      } catch (err) {
        setErro(mensagemDeErro(err, "Não foi possível reenviar o email."));
      }
    });
  };

  if (enviadoPara) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-[#d4a24a]" aria-hidden />
        <p className="font-serif text-2xl font-bold text-white">Verifica o teu email.</p>
        <p className="text-sm leading-relaxed text-white/60">
          Enviámos um link para <strong className="text-white/85">{enviadoPara}</strong>. Abre-o para escolheres a tua
          palavra-passe — a tua conta de professor é criada nesse momento. O link vale 3 dias.
        </p>
        {aviso && <AuthAlert tipo="sucesso">{aviso}</AuthAlert>}
        {erro && <AuthAlert tipo="erro">{erro}</AuthAlert>}
        <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={reenviar} className={authButtonClass}>
          {isPending ? <AuthSpinner texto="A enviar…" /> : "Não recebi o email — reenviar"}
        </Button>
        <p className="text-xs text-white/45">Vê também a pasta de spam.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="prof-nome" className="text-sm text-white/85">Nome completo</Label>
        <Input id="prof-nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={isPending} autoComplete="name" className={authInputClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prof-email" className="text-sm text-white/85">Email</Label>
        <Input id="prof-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} autoComplete="email" className={authInputClass} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="prof-telefone" className="text-sm text-white/85">
            Telefone <span className="text-white/40">(opcional)</span>
          </Label>
          <Input id="prof-telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={isPending} autoComplete="tel" className={authInputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prof-area" className="text-sm text-white/85">
            Área <span className="text-white/40">(opcional)</span>
          </Label>
          <Input id="prof-area" value={area} onChange={(e) => setArea(e.target.value)} disabled={isPending} placeholder="ex: Língua gestual" className={authInputClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="prof-apresentacao" className="text-sm text-white/85">
          Fala-nos de ti <span className="text-white/40">(opcional)</span>
        </Label>
        <Textarea id="prof-apresentacao" value={apresentacao} onChange={(e) => setApresentacao(e.target.value)} disabled={isPending} maxLength={1000} className={textareaClass} />
      </div>

      {erro && <AuthAlert tipo="erro">{erro}</AuthAlert>}

      <Button type="submit" size="lg" disabled={isPending} className={authButtonClass}>
        {isPending ? <AuthSpinner texto="A enviar…" /> : "Enviar pedido"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-white/45">
        Recebes um email para confirmar o endereço e escolher a palavra-passe; a conta de professor é criada nesse momento.
      </p>
    </form>
  );
}
