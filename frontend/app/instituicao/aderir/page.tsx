"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, Clock, ShieldCheck, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-gate";
import { useInstituicao } from "@/components/instituicao/contexto";
import { Caixa, Campo, erroTexto, EtiquetaPapel } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";
import type { FinalidadeConsentimento } from "@/lib/instituicoes/tipos";

type Info = Awaited<ReturnType<typeof api.consultarCodigo>>;

export default function AderirPage() {
  return (
    <Suspense fallback={null}>
      <Aderir />
    </Suspense>
  );
}

function Aderir() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { recarregar, escolher } = useInstituicao();
  const [codigo, setCodigo] = useState(params.get("codigo") ?? "");
  const [info, setInfo] = useState<Info | null>(null);
  const [nome, setNome] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [decisoes, setDecisoes] = useState<Partial<Record<FinalidadeConsentimento, boolean>>>({});
  const [comApoio, setComApoio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "membro" | "pendente"; instituicaoId: string } | null>(null);
  const texto = api.textoConsentimento();

  const consultar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      setInfo(await api.consultarCodigo(codigo));
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  const aderir = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    try {
      const r = await api.aderir(codigo, { nome: nome.trim(), email: email.trim(), consentimentos: decisoes, comApoio });
      setResultado({ tipo: r.resultado, instituicaoId: r.instituicaoId });
      if (r.resultado === "membro") {
        await recarregar();
        escolher(r.instituicaoId);
      }
    } catch (err) {
      setErro(erroTexto(err));
    } finally {
      setAEnviar(false);
    }
  };

  const obrigatoriasOk = texto.finalidades.filter((f) => f.obrigatoria).every((f) => decisoes[f.id]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/instituicao" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Instituição
      </Link>

      {resultado ? (
        <Card className="flex flex-col items-center gap-4 p-8 text-center shadow-soft">
          {resultado.tipo === "membro" ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
              <div>
                <h1 className="font-serif text-2xl font-semibold">Bem-vindo à {info?.instituicao}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Já fazes parte da instituição como {info && <EtiquetaPapel papel={info.papel} />}.</p>
              </div>
              <Button onClick={() => router.push("/instituicao")}>Abrir a instituição</Button>
            </>
          ) : (
            <>
              <Clock className="h-12 w-12 text-primary" aria-hidden />
              <div>
                <h1 className="font-serif text-2xl font-semibold">Pedido enviado</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  A administração da {info?.instituicao} vai rever o teu pedido. Recebes uma notificação quando for aprovado.
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push("/inicio")}>
                Voltar ao início
              </Button>
            </>
          )}
        </Card>
      ) : !info ? (
        <Card className="space-y-5 p-6 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <Ticket className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold">Aderir com um código</h1>
              <p className="text-sm text-muted-foreground">Escreve o código que a escola, centro ou associação te deu.</p>
            </div>
          </div>
          <form onSubmit={consultar} className="space-y-4">
            <Input
              aria-label="Código de adesão"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="EX: TURMA3A"
              className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
              autoComplete="off"
              autoFocus
              required
            />
            {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            <Button type="submit" className="w-full" disabled={aEnviar || codigo.trim().length < 4}>
              {aEnviar ? "A verificar…" : "Continuar"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">Na demonstração, experimenta TURMA3A, MAOS2026 ou P4X8D2.</p>
        </Card>
      ) : (
        <form onSubmit={aderir} className="space-y-6">
          <Card className="space-y-4 p-6 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
                <Building2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold">{info.instituicao}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  Vais entrar como <EtiquetaPapel papel={info.papel} />
                  {info.grupo && <>em {info.grupo}</>}
                  {info.aluno && <>· tutor de {info.aluno.nome}</>}
                </p>
              </div>
            </div>
            {info.jaMembro && (
              <p className="rounded-md bg-surface p-3 text-sm text-muted-foreground">
                Já pertences a esta instituição: o código acrescenta o grupo ou a criança à tua conta.
              </p>
            )}
            {info.requerAprovacao && (
              <p className="rounded-md bg-primary/10 p-3 text-sm">A administração aprova os pedidos feitos por código antes de dar acesso.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="ad-nome" rotulo="O teu nome">
                <Input id="ad-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </Campo>
              <Campo id="ad-email" rotulo="Email (opcional para famílias)">
                <Input id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Campo>
            </div>
          </Card>

          {info.pedeConsentimento && (
            <Card className="space-y-4 p-6 shadow-soft">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="font-serif text-lg font-semibold">Consentimento para {info.aluno?.nome}</h2>
              </div>
              <ul className="space-y-1.5 text-sm">
                {texto.resumo.map((linha) => (
                  <li key={linha} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {linha}
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <p className="text-sm font-medium">Escolhe cada finalidade:</p>
                {texto.finalidades.map((f) => (
                  <Caixa
                    key={f.id}
                    id={`ad-c-${f.id}`}
                    checked={!!decisoes[f.id]}
                    onChange={(v) => setDecisoes((d) => ({ ...d, [f.id]: v }))}
                    descricao={f.descricao}
                  >
                    {f.titulo}
                    {f.obrigatoria && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(necessária para a criança ter perfil)</span>}
                  </Caixa>
                ))}
              </div>
              <Caixa id="ad-apoio" checked={comApoio} onChange={setComApoio} descricao="Assinala se alguém da instituição te ajudou a ler e preencher.">
                Preenchido com apoio presencial
              </Caixa>
              <p className="text-xs text-muted-foreground">
                Versão do texto {texto.versao}. Podes mudar ou retirar cada consentimento a qualquer momento em Instituição →
                Consentimentos.
              </p>
            </Card>
          )}

          {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { setInfo(null); setErro(null); }}>
              Outro código
            </Button>
            <Button type="submit" disabled={aEnviar || !nome.trim() || (info.pedeConsentimento && !obrigatoriasOk)}>
              {aEnviar ? "A enviar…" : info.requerAprovacao ? "Enviar pedido" : "Aderir"}
            </Button>
          </div>
          {info.pedeConsentimento && !obrigatoriasOk && (
            <p className="text-right text-xs text-muted-foreground">Sem o consentimento de utilização a criança não pode ter perfil.</p>
          )}
        </form>
      )}
    </div>
  );
}
