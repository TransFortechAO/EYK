"use client";

import Link from "next/link";
import { ArrowRight, Baby, CalendarDays, HardDrive, Megaphone, Ticket, UserCheck, Users, UsersRound } from "lucide-react";
import { SectionHeader, StatCard } from "@/components/eyk";
import { Card } from "@/components/ui/card";
import { useInstituicaoAtual } from "@/components/instituicao/contexto";
import { Barra, Carregando, dataHora, diaLuanda, ErroCarregar, Etiqueta, FUSO, haQuanto, tamanho, useCarregar } from "@/components/instituicao/ui";
import { apiInstituicoes as api } from "@/lib/instituicoes/api";

export default function PainelInstituicaoPage() {
  const { instituicaoId, papel, pode, vePessoais, atual } = useInstituicaoAtual();

  const { dados, erro, aCarregar, recarregar } = useCarregar(async () => {
    const [avisos, eventos, grupos, alunos, membros, pedidos, convites, uso] = await Promise.all([
      pode("ver_avisos") ? api.listarAvisos(instituicaoId) : Promise.resolve([]),
      pode("ver_agenda") ? api.listarEventos(instituicaoId) : Promise.resolve([]),
      pode("gerir_grupos") || pode("ver_todos_grupos") ? api.listarGrupos(instituicaoId) : Promise.resolve([]),
      vePessoais ? api.listarAlunos(instituicaoId) : Promise.resolve([]),
      vePessoais && papel !== "familia" && papel !== "aluno" ? api.listarMembros(instituicaoId) : Promise.resolve([]),
      pode("aprovar_pedidos") ? api.listarPedidosAdesao(instituicaoId) : Promise.resolve([]),
      pode("convidar") ? api.listarConvites(instituicaoId) : Promise.resolve([]),
      pode("gerir_definicoes") ? api.usoArmazenamento(instituicaoId) : Promise.resolve(null),
    ]);
    return { avisos, eventos, grupos, alunos, membros, pedidos, convites, uso };
  }, [instituicaoId, papel]);

  if (aCarregar && !dados) return <Carregando />;
  if (!dados) return <ErroCarregar erro={erro ?? "Erro"} recarregar={recarregar} />;

  const agora = Date.now();
  const proximos = dados.eventos.filter((e) => !e.cancelado && new Date(e.inicio).getTime() >= agora).slice(0, 4);
  const porLer = dados.avisos.filter((a) => !a.lidoPorMim && a.autorId !== atual.membro.id);
  const porConfirmar = dados.avisos.filter((a) => a.pedirConfirmacao && !a.confirmadoPorMim && a.autorId !== atual.membro.id);
  const pedidosPendentes = dados.pedidos.filter((p) => p.estado === "pendente");
  const convitesAtivos = dados.convites.filter((c) => c.estado === "pendente");
  const aguardaConsentimento = dados.alunos.filter((a) => a.estado === "aguarda_consentimento");

  return (
    <div className="space-y-8">
      {(pedidosPendentes.length > 0 || aguardaConsentimento.length > 0 || porConfirmar.length > 0) && (
        <div className="space-y-2">
          {pedidosPendentes.length > 0 && (
            <Lembrete href="/instituicao/convites#pedidos" icone={UserCheck}>
              {pedidosPendentes.length} pedido{pedidosPendentes.length === 1 ? "" : "s"} de adesão à espera de aprovação.
            </Lembrete>
          )}
          {aguardaConsentimento.length > 0 && papel !== "familia" && (
            <Lembrete href="/instituicao/alunos" icone={Baby}>
              {aguardaConsentimento.length} perfil{aguardaConsentimento.length === 1 ? "" : "s"} de criança à espera do
              consentimento do tutor.
            </Lembrete>
          )}
          {porConfirmar.length > 0 && (
            <Lembrete href="/instituicao/avisos" icone={Megaphone}>
              {porConfirmar.length} aviso{porConfirmar.length === 1 ? "" : "s"} pede{porConfirmar.length === 1 ? "" : "m"} a tua
              confirmação de leitura.
            </Lembrete>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Megaphone} label="Avisos por ler" value={porLer.length} hint={`${dados.avisos.length} no total`} tone="gold" />
        <StatCard icon={CalendarDays} label="Próximos eventos" value={proximos.length} hint={proximos[0] ? `o próximo ${haQuanto(proximos[0].inicio)}` : "nada agendado"} />
        {papel === "familia" ? (
          <StatCard icon={Baby} label="As minhas crianças" value={dados.alunos.length} />
        ) : (
          <StatCard icon={UsersRound} label="Grupos" value={dados.grupos.length} hint={`${dados.alunos.length} alunos com perfil`} />
        )}
        {dados.membros.length > 0 ? (
          <StatCard icon={Users} label="Membros" value={dados.membros.filter((m) => m.estado === "ativo").length} hint={`${convitesAtivos.length} convites ativos`} />
        ) : (
          <StatCard icon={Ticket} label="Grupos onde estás" value={atual.membro.gruposIds.length} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Avisos recentes" href="/instituicao/avisos" />
          <Card className="divide-y divide-border shadow-soft">
            {dados.avisos.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/instituicao/avisos#${a.id}`} className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-surface/60">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.autor} · {haQuanto(a.publicadoEm)}
                  </p>
                </div>
                {!a.lidoPorMim && a.autorId !== atual.membro.id && <Etiqueta tom="marca">Novo</Etiqueta>}
              </Link>
            ))}
            {dados.avisos.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sem avisos.</p>}
          </Card>
        </section>

        <section>
          <SectionHeader title="Próximos eventos" href="/instituicao/agenda" cta="Ver agenda" />
          <Card className="divide-y divide-border shadow-soft">
            {proximos.map((e) => (
              <Link key={e.id} href="/instituicao/agenda" className="flex items-center gap-3 p-4 transition-colors hover:bg-surface/60">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-center leading-none text-primary">
                  <span className="text-lg font-semibold">{Number(diaLuanda(e.inicio).slice(8))}</span>
                  <span className="text-[10px] uppercase">{new Date(e.inicio).toLocaleDateString("pt-PT", { month: "short", timeZone: FUSO })}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.titulo}</p>
                  <p className="text-xs text-muted-foreground">{dataHora(e.inicio)}{e.local ? ` · ${e.local}` : ""}</p>
                </div>
              </Link>
            ))}
            {proximos.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nada agendado.</p>}
          </Card>
        </section>
      </div>

      {dados.uso && (
        <Card className="space-y-3 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-medium">
              <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden /> Armazenamento
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {tamanho(dados.uso.usadoBytes)} de {tamanho(dados.uso.quotaBytes)}
            </p>
          </div>
          <Barra valor={dados.uso.usadoBytes} max={dados.uso.quotaBytes} rotulo="Armazenamento usado" />
        </Card>
      )}
    </div>
  );
}

function Lembrete({ href, icone: Icone, children }: { href: string; icone: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm transition-colors hover:bg-primary/10"
    >
      <span className="flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 text-primary" />
        {children}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
    </Link>
  );
}
