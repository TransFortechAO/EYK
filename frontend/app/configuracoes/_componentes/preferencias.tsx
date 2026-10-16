"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, mensagemDeErro, type TamanhoTexto } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import { aplicarPreferenciasVisuais } from "@/lib/preferencias-visuais";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Dados = Parameters<typeof api.preferencias.atualizar>[0];

/** Guarda uma (ou mais) preferências e atualiza o utilizador em memória. */
export function useGuardarPreferencias() {
  const { refresh } = useAuth();
  return async (dados: Dados): Promise<boolean> => {
    try {
      await api.preferencias.atualizar(dados);
      await refresh();
      return true;
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível guardar. Tenta de novo."));
      return false;
    }
  };
}

export function LinhaInterruptor({
  titulo,
  descricao,
  valor,
  onChange,
  id,
}: {
  titulo: string;
  descricao: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <label htmlFor={id} className="font-medium">
          {titulo}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
      </div>
      <Switch id={id} checked={valor} onCheckedChange={onChange} />
    </div>
  );
}

/** Grupo de botões de escolha única (acessível como radiogroup). */
export function Escolha<T extends string | number>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { valor: T; label: string; descricao?: string }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-surface",
            valor === o.valor ? "border-primary bg-primary/10 font-medium ring-1 ring-primary" : "border-border",
          )}
        >
          {o.label}
          {o.descricao && <span className="block text-xs font-normal text-muted-foreground">{o.descricao}</span>}
        </button>
      ))}
    </div>
  );
}

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SecaoReproducao() {
  const { user } = useAuth();
  const guardar = useGuardarPreferencias();
  const p = user?.preferencias;
  const [velocidade, setVelocidade] = useState(p?.velocidadeReproducao ?? 1);

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-6 shadow-soft">
        <div>
          <p className="font-medium">Velocidade por omissão</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Os vídeos começam sempre a esta velocidade. Abrandar (0.75x) ajuda a acompanhar os gestos com calma.
          </p>
        </div>
        <Escolha
          rotulo="Velocidade por omissão"
          valor={velocidade}
          onChange={(v) => {
            setVelocidade(v);
            void guardar({ velocidade_reproducao: v });
          }}
          opcoes={VELOCIDADES.map((v) => ({ valor: v, label: v === 1 ? "Normal" : `${v}x` }))}
        />
      </Card>

      <Card className="divide-y p-6 shadow-soft">
        <LinhaInterruptor
          id="pref-legendas"
          titulo="Legendas ligadas"
          descricao="Mostra as legendas automaticamente quando o professor as carregou. Podes ligar/desligar no player (botão CC ou tecla C)."
          valor={p?.legendasAtivas ?? true}
          onChange={(v) => void guardar({ legendas_ativas: v })}
        />
        <LinhaInterruptor
          id="pref-autoplay"
          titulo="Passar à aula seguinte automaticamente"
          descricao="Ao terminar uma aula, a seguinte começa ao fim de 5 segundos (podes cancelar)."
          valor={p?.autoplayProximaAula ?? true}
          onChange={(v) => void guardar({ autoplay_proxima_aula: v })}
        />
        <LinhaInterruptor
          id="pref-retomar"
          titulo="Retomar onde ficaste"
          descricao="Ao voltar a um vídeo, continua do ponto onde paraste. Desligado, começa sempre do início."
          valor={p?.retomarPosicao ?? true}
          onChange={(v) => void guardar({ retomar_posicao: v })}
        />
      </Card>
    </div>
  );
}

export function SecaoAcessibilidade() {
  const { user } = useAuth();
  const guardar = useGuardarPreferencias();
  const p = user?.preferencias;
  const atual = {
    tamanhoTexto: (p?.tamanhoTexto ?? "normal") as TamanhoTexto,
    altoContraste: p?.altoContraste ?? false,
    reduzirAnimacoes: p?.reduzirAnimacoes ?? false,
  };

  // Aplica logo (sem esperar pelo servidor) e depois guarda na conta.
  const mudar = (alteracao: Partial<typeof atual>, dados: Dados) => {
    aplicarPreferenciasVisuais({ ...atual, ...alteracao });
    void guardar(dados);
  };

  return (
    <>
      <Card className="space-y-3 p-6 shadow-soft">
        <div>
          <p className="font-medium">Tamanho do texto</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Aumenta o texto e os botões em toda a plataforma.</p>
        </div>
        <Escolha<TamanhoTexto>
          rotulo="Tamanho do texto"
          valor={atual.tamanhoTexto}
          onChange={(v) => mudar({ tamanhoTexto: v }, { tamanho_texto: v })}
          opcoes={[
            { valor: "normal", label: "Normal" },
            { valor: "grande", label: "Grande" },
            { valor: "muito_grande", label: "Muito grande" },
          ]}
        />
      </Card>
      <Card className="divide-y p-6 shadow-soft">
        <LinhaInterruptor
          id="pref-contraste"
          titulo="Alto contraste"
          descricao="Texto secundário mais escuro, contornos mais fortes e links sublinhados."
          valor={atual.altoContraste}
          onChange={(v) => mudar({ altoContraste: v }, { alto_contraste: v })}
        />
        <LinhaInterruptor
          id="pref-animacoes"
          titulo="Reduzir animações"
          descricao="Desliga transições e efeitos de movimento. As animações dos gestos LGA continuam, porque mostram como o gesto se faz."
          valor={atual.reduzirAnimacoes}
          onChange={(v) => mudar({ reduzirAnimacoes: v }, { reduzir_animacoes: v })}
        />
      </Card>
    </>
  );
}
