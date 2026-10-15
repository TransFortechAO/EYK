"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Eye, UserX } from "lucide-react";
import { toast } from "sonner";
import { api, formatarDataCurta, mensagemDeErro, type UtilizadorResumo } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Escolha, LinhaInterruptor, useGuardarPreferencias } from "./preferencias";

export function SecaoPrivacidade() {
  const { user } = useAuth();
  const guardar = useGuardarPreferencias();
  const p = user?.privacidade;

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium">Quem pode ver o meu perfil</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Quem não puder ver o teu perfil só vê o teu nome e foto.
            </p>
          </div>
          {user && (
            <Button asChild variant="outline" size="sm" className="gap-2 shrink-0">
              <Link href={`/perfil/${user.id}?visitante=1`}>
                <Eye className="h-4 w-4" /> Ver como os outros veem
              </Link>
            </Button>
          )}
        </div>
        <Escolha
          rotulo="Quem pode ver o meu perfil"
          valor={p?.perfilVisibilidade ?? "todos"}
          onChange={(v) => void guardar({ perfil_visibilidade: v })}
          opcoes={[
            { valor: "todos", label: "Toda a gente", descricao: "Qualquer utilizador da EYK." },
            { valor: "cursos", label: "Só colegas de curso", descricao: "Quem está inscrito nos mesmos cursos (e os professores deles)." },
          ]}
        />
      </Card>

      <Card className="divide-y p-6 shadow-soft">
        <LinhaInterruptor
          id="priv-ranking"
          titulo="Aparecer no ranking"
          descricao="Desligado, o teu nome deixa de aparecer no Leaderboard (continuas a ganhar moedas e XP)."
          valor={p?.aparecerRanking ?? true}
          onChange={(v) => void guardar({ aparecer_ranking: v })}
        />
        <LinhaInterruptor
          id="priv-cursos"
          titulo="Mostrar cursos concluídos no perfil"
          descricao="Inclui o link de verificação de cada certificado."
          valor={p?.mostrarCursos ?? true}
          onChange={(v) => void guardar({ mostrar_cursos_perfil: v })}
        />
        <LinhaInterruptor
          id="priv-conquistas"
          titulo="Mostrar conquistas e nível no perfil"
          descricao="Os badges que já desbloqueaste."
          valor={p?.mostrarConquistas ?? true}
          onChange={(v) => void guardar({ mostrar_conquistas_perfil: v })}
        />
        <LinhaInterruptor
          id="priv-publicacoes"
          titulo="Mostrar as minhas publicações no perfil"
          descricao="As publicações continuam visíveis na Comunidade; isto só as tira do teu perfil."
          valor={p?.mostrarPublicacoes ?? true}
          onChange={(v) => void guardar({ mostrar_publicacoes_perfil: v })}
        />
      </Card>

      <UtilizadoresBloqueados />

      <Card className="space-y-3 p-6 shadow-soft">
        <div>
          <p className="font-medium">Exportar os meus dados</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Descarrega um ficheiro com todos os teus dados na EYK: conta, cursos, certificados, publicações,
            comentários, gamificação e decisões de moderação. É um direito teu pela Lei n.º 22/11 de Proteção de Dados Pessoais.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit gap-2">
          <a href={api.seguranca.exportarDadosUrl()} download>
            <Download className="h-4 w-4" /> Descarregar os meus dados (JSON)
          </a>
        </Button>
      </Card>
    </div>
  );
}

function UtilizadoresBloqueados() {
  const [lista, setLista] = useState<(UtilizadorResumo & { bloqueadoEm: string })[] | null>(null);

  useEffect(() => {
    api.moderacao.bloqueados().then(setLista).catch(() => setLista([]));
  }, []);

  const desbloquear = async (u: UtilizadorResumo) => {
    try {
      await api.moderacao.alternarBloqueio(u.id);
      setLista((prev) => (prev || []).filter((x) => x.id !== u.id));
      toast.success(`${u.nome} foi desbloqueado.`);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível desbloquear."));
    }
  };

  return (
    <Card className="space-y-4 p-6 shadow-soft">
      <div>
        <p className="font-medium">Utilizadores bloqueados</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Não vês as publicações e comentários destas pessoas, e elas não veem os teus.
        </p>
      </div>
      {lista === null ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : lista.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <UserX className="h-4 w-4" /> Não bloqueaste ninguém.
        </p>
      ) : (
        <ul className="divide-y">
          {lista.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar className="h-9 w-9">
                <UserAvatar name={u.nome} foto={u.foto} userId={u.id} size={36} />
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.nome}</p>
                <p className="text-xs text-muted-foreground">Bloqueado a {formatarDataCurta(u.bloqueadoEm)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void desbloquear(u)}>
                Desbloquear
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
