"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  LoaderCircle,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Repeat,
  MoreVertical,
  Gauge,
  PictureInPicture2,
  Check,
  FileText,
  Download,
  HardDriveDownload,
  Trash2,
  Captions,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, mediaUrl, type CursoRecurso } from "@/lib/api";
import { useAuth } from "@/components/auth-gate";
import {
  guardarAutomaticamenteSeElegivel,
  guardarVideoOffline,
  offlineSuportado,
  removerVideoOffline,
  videoEstaOffline,
} from "@/lib/offline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

interface VideoSource {
  fileUrl?: string | null;
  externalUrl?: string;
  title?: string;
  thumbnail?: string;
}

// Referência estável: usar `suggestions = []` como valor por omissão criaria um array
// novo a cada render, o que faria o useEffect abaixo (que depende de `suggestions`)
// disparar infinitamente. Esta constante garante a mesma referência sempre que a prop
// não for passada.
const EMPTY_SUGGESTIONS: VideoSource[] = [];

interface ModernVideoPlayerProps extends VideoSource {
  className?: string;
  autoPlay?: boolean;
  /**
   * Fila de vídeos sugeridos para o modo NÃO controlado: o botão "seguinte" troca
   * o vídeo internamente (sem o pai intervir), consumindo o primeiro item da lista.
   * Ignorado quando `onNext`/`onPrevious` são fornecidos (modo controlado).
   */
  suggestions?: VideoSource[];
  /** Chamado sempre que o vídeo atual muda internamente (apenas no modo não controlado). */
  onVideoChange?: (video: VideoSource, direction: "next" | "previous") => void;
  /**
   * Modo controlado: quando `onNext` e/ou `onPrevious` são passados, o player deixa de
   * gerir a fila internamente e delega a troca de vídeo ao componente pai — útil quando
   * "seguinte"/"anterior" significa navegar para outra página (ex: outro vídeo com a sua
   * própria URL, likes e comentários). Nesse caso, `hasNext`/`hasPrevious` controlam se os
   * botões ficam habilitados.
   */
  hasNext?: boolean;
  hasPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  /**
   * Quando definido, regista uma "view" ao fim de 1 minuto de reprodução
   * CONTÍNUA (pausar ou trocar de vídeo reinicia a contagem — regra
   * anti-fraude do modelo de coins). Só funciona para ficheiro próprio —
   * embeds/links externos não expõem o estado de reprodução.
   *
   * Também liga o "retomar onde ficaste": a posição é guardada no servidor
   * enquanto o vídeo toca e reposta ao voltar a abri-lo.
   */
  videoId?: string | number;
  /** Chamado quando uma "view" é mesmo registada (ver `videoId`) — por
   * exemplo, para desbloquear a aula seguinte de um curso sem recarregar a página. */
  onViewRegistered?: () => void;
  /** Recursos (PDFs) do vídeo/curso — aparecem no menu de opções do player,
   * com download direto. Qualquer utilizador autenticado pode descarregar. */
  recursos?: CursoRecurso[];
  /** O vídeo (de `videoId`) tem legendas carregadas pelo professor. */
  temLegenda?: boolean;
}

const EMPTY_RECURSOS: CursoRecurso[] = [];

export function ModernVideoPlayer({
  fileUrl,
  externalUrl,
  title,
  thumbnail,
  className,
  autoPlay = true,
  suggestions = EMPTY_SUGGESTIONS,
  onVideoChange,
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  videoId,
  onViewRegistered,
  recursos = EMPTY_RECURSOS,
  temLegenda = false,
}: ModernVideoPlayerProps) {
  // Preferências de Configurações → Reprodução (com valores por omissão
  // iguais aos do servidor, para quem ainda não as tem no payload).
  const { user } = useAuth();
  const velocidadePreferida = user?.preferencias?.velocidadeReproducao ?? 1;
  const autoplayProximaAula = user?.preferencias?.autoplayProximaAula ?? true;
  const retomarPosicao = user?.preferencias?.retomarPosicao ?? true;
  const legendasPorOmissao = user?.preferencias?.legendasAtivas ?? true;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(velocidadePreferida);
  const [isPiP, setIsPiP] = useState(false);
  const pipDisponivel =
    typeof document !== "undefined" && document.pictureInPictureEnabled;

  // --- Contagem regressiva antes de avançar automaticamente para o próximo vídeo ---
  const NEXT_COUNTDOWN_SECONDS = 5;
  const [nextCountdown, setNextCountdown] = useState<number | null>(null); // null = sem contagem ativa
  const nextCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Vídeo atual e navegação (seguinte / anterior) ---
  const [current, setCurrent] = useState<VideoSource>({ fileUrl, externalUrl, title, thumbnail });
  const [queue, setQueue] = useState<VideoSource[]>(suggestions);
  const [history, setHistory] = useState<VideoSource[]>([]);

  // Modo controlado: o pai (ex: a página do vídeo) decide o que "seguinte"/"anterior" significa.
  // Calculado a partir de props, não muda de valor a cada render.
  const isControlledNav = onNext !== undefined || onPrevious !== undefined;

  // Se o vídeo vier de fora (props mudaram por ação do pai), sincroniza e reinicia o histórico.
  useEffect(() => {
    setCurrent({ fileUrl, externalUrl, title, thumbnail });
    setHistory([]);
  }, [fileUrl, externalUrl]);

  // --- Registo de "view" ao fim de 1 min de reprodução contínua ---
  const segundosContinuosRef = useRef(0);
  const intervaloViewRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewRegistadaRef = useRef(false);

  const pararContagemView = useCallback(() => {
    segundosContinuosRef.current = 0;
    if (intervaloViewRef.current) {
      clearInterval(intervaloViewRef.current);
      intervaloViewRef.current = null;
    }
  }, []);

  useEffect(() => {
    // vídeo novo (troca de fonte) — reinicia a contagem de view
    viewRegistadaRef.current = false;
    pararContagemView();
    return pararContagemView;
  }, [videoId, fileUrl, pararContagemView]);

  const aoIniciarReproducaoParaView = useCallback(() => {
    if (!videoId || viewRegistadaRef.current || intervaloViewRef.current) return;
    intervaloViewRef.current = setInterval(() => {
      segundosContinuosRef.current += 1;
      if (segundosContinuosRef.current >= 60) {
        viewRegistadaRef.current = true;
        pararContagemView();
        void api.registarViewVideo(videoId).then((res) => {
          if (res?.novaView) onViewRegistered?.();
        });
        // Vídeo "já visto": guarda-o para ver sem internet (se for pequeno o
        // suficiente e o utilizador não estiver em poupança de dados).
        if (fileUrl) {
          void guardarAutomaticamenteSeElegivel(fileUrl, title || "Vídeo").then((guardado) => {
            if (guardado) setEstadoOffline("sim");
          });
        }
      }
    }, 1000);
  }, [videoId, pararContagemView, onViewRegistered, fileUrl, title]);

  // --- Retomar onde ficaste ---
  // Só se aplica ao vídeo das props (com `videoId`) — no modo não controlado,
  // os vídeos da fila de sugestões não têm id e não guardam posição.
  const retomaAtiva = !!videoId && !!current.fileUrl && current.fileUrl === fileUrl;
  const posicaoPendenteRef = useRef<number | null>(null);
  const tempoAtualRef = useRef(0);
  const ultimaPosicaoGuardadaRef = useRef(0);
  // Só guarda depois de o utilizador ter mesmo reproduzido — abrir e fechar a
  // aula sem dar play não pode apagar a posição guardada (escrevendo 0).
  const reproduziuRef = useRef(false);
  const [retomadoEm, setRetomadoEm] = useState<number | null>(null);

  const aplicarPosicaoPendente = useCallback(() => {
    const video = videoRef.current;
    const segundos = posicaoPendenteRef.current;
    if (!video || segundos === null || video.readyState < 1) return;
    posicaoPendenteRef.current = null;
    const d = video.duration;
    if (segundos < 5 || (Number.isFinite(d) && segundos >= d - 10)) return;
    video.currentTime = segundos;
    setCurrentTime(segundos);
    tempoAtualRef.current = segundos;
    ultimaPosicaoGuardadaRef.current = segundos;
    setRetomadoEm(segundos);
  }, []);

  const guardarPosicao = useCallback(
    (keepalive = false) => {
      if (!retomaAtiva || !videoId || !reproduziuRef.current) return;
      ultimaPosicaoGuardadaRef.current = tempoAtualRef.current;
      void api.guardarPosicaoVideo(videoId, tempoAtualRef.current, keepalive);
    },
    [retomaAtiva, videoId],
  );

  useEffect(() => {
    posicaoPendenteRef.current = null;
    reproduziuRef.current = false;
    tempoAtualRef.current = 0;
    ultimaPosicaoGuardadaRef.current = 0;
    setRetomadoEm(null);
    if (!retomaAtiva || !videoId) return;

    let vivo = true;
    // "Retomar onde ficaste" desligado: a posição continua a ser guardada
    // (para voltar a funcionar se o religar), mas começa sempre do início.
    if (!retomarPosicao) return;
    void api.getPosicaoVideo(videoId).then((segundos) => {
      // Se entretanto o utilizador já avançou por conta própria, não salta.
      if (!vivo || (reproduziuRef.current && tempoAtualRef.current > 5)) return;
      posicaoPendenteRef.current = segundos;
      aplicarPosicaoPendente();
    });

    const id = videoId;
    return () => {
      vivo = false;
      // Ao trocar de aula ou sair da página, guarda onde ficou (keepalive: o
      // pedido termina mesmo que a página esteja a fechar).
      if (reproduziuRef.current) void api.guardarPosicaoVideo(id, tempoAtualRef.current, true);
    };
  }, [videoId, fileUrl, retomaAtiva, aplicarPosicaoPendente, retomarPosicao]);

  // --- Legendas (WebVTT carregado pelo professor) ---
  const [legendaUrl, setLegendaUrl] = useState<string | null>(null);
  const [legendasVisiveis, setLegendasVisiveis] = useState(legendasPorOmissao);
  const legendaDoVideoAtual = temLegenda && !!videoId && current.fileUrl === fileUrl;

  useEffect(() => {
    setLegendaUrl(null);
    if (!legendaDoVideoAtual || !videoId) return;
    let vivo = true;
    let url: string | null = null;
    void api.carregarLegenda(videoId).then((u) => {
      url = u;
      if (vivo) setLegendaUrl(u);
      else if (u) URL.revokeObjectURL(u);
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [legendaDoVideoAtual, videoId]);

  // O atributo `default` do <track> só conta no primeiro carregamento — o
  // modo de cada faixa é o que manda a partir daí.
  useEffect(() => {
    const faixas = videoRef.current?.textTracks;
    if (!faixas) return;
    for (let i = 0; i < faixas.length; i++) {
      faixas[i].mode = legendasVisiveis ? "showing" : "hidden";
    }
  }, [legendasVisiveis, legendaUrl]);

  // Fechar o separador / mudar de app no telemóvel: guarda já a posição.
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") guardarPosicao(true);
    };
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("pagehide", aoEsconder);
    };
  }, [guardarPosicao]);

  useEffect(() => {
    if (retomadoEm === null) return;
    const t = setTimeout(() => setRetomadoEm(null), 6000);
    return () => clearTimeout(t);
  }, [retomadoEm]);

  const recomecarDoInicio = () => {
    if (videoRef.current) videoRef.current.currentTime = 0;
    setCurrentTime(0);
    tempoAtualRef.current = 0;
    setRetomadoEm(null);
  };

  // --- Ver offline (PWA) ---
  const [estadoOffline, setEstadoOffline] = useState<"indisponivel" | "nao" | "a-guardar" | "sim">("indisponivel");

  useEffect(() => {
    const url = current.fileUrl;
    if (!url || !offlineSuportado()) {
      setEstadoOffline("indisponivel");
      return;
    }
    let vivo = true;
    void videoEstaOffline(url).then((guardado) => {
      if (vivo) setEstadoOffline(guardado ? "sim" : "nao");
    });
    return () => {
      vivo = false;
    };
  }, [current.fileUrl]);

  const alternarOffline = async () => {
    const url = current.fileUrl;
    if (!url) return;
    if (estadoOffline === "sim") {
      await removerVideoOffline(url);
      setEstadoOffline("nao");
      toast.success("Vídeo removido deste dispositivo.");
      return;
    }
    setEstadoOffline("a-guardar");
    try {
      const bytes = await guardarVideoOffline(url, current.title || "Vídeo");
      setEstadoOffline("sim");
      toast.success(`Vídeo guardado para ver offline (${(bytes / (1024 * 1024)).toFixed(0)} MB).`);
    } catch {
      setEstadoOffline("nao");
      toast.error("Não foi possível guardar o vídeo. Verifica a ligação e o espaço disponível.");
    }
  };

  // Mantém a fila de sugestões atualizada quando o pai enviar uma nova lista.
  // Só é relevante no modo NÃO controlado — no modo controlado a fila nem chega a ser usada.
  useEffect(() => {
    if (isControlledNav) return;
    setQueue(suggestions);
  }, [suggestions, isControlledNav]);

  const canGoNext = isControlledNav ? !!hasNext : queue.length > 0;
  const canGoPrevious = isControlledNav ? !!hasPrevious : history.length > 0;

  const goToNext = useCallback(() => {
    if (isControlledNav) {
      onNext?.();
      return;
    }
    setQueue((prevQueue: VideoSource[]) => {
      if (prevQueue.length === 0) return prevQueue;
      const [nextVideo, ...rest] = prevQueue;
      setHistory((prevHistory: VideoSource[]) => [...prevHistory, current]);
      setCurrent(nextVideo);
      onVideoChange?.(nextVideo, "next");
      return rest;
    });
  }, [current, onVideoChange, isControlledNav, onNext]);

  const goToPrevious = useCallback(() => {
    if (isControlledNav) {
      onPrevious?.();
      return;
    }
    setHistory((prevHistory: VideoSource[]) => {
      if (prevHistory.length === 0) return prevHistory;
      const previousVideo = prevHistory[prevHistory.length - 1];
      setQueue((prevQueue: VideoSource[]) => [current, ...prevQueue]);
      setCurrent(previousVideo);
      onVideoChange?.(previousVideo, "previous");
      return prevHistory.slice(0, -1);
    });
  }, [current, onVideoChange, isControlledNav, onPrevious]);

  // Cancela a contagem regressiva de "próximo vídeo" (chamado ao trocar de vídeo,
  // ao desmontar, ou quando o utilizador cancela manualmente).
  const cancelNextCountdown = useCallback(() => {
    if (nextCountdownIntervalRef.current) {
      clearInterval(nextCountdownIntervalRef.current);
      nextCountdownIntervalRef.current = null;
    }
    setNextCountdown(null);
  }, []);

  // Inicia a contagem regressiva de 5s ao fim do vídeo, dando ao utilizador a
  // oportunidade de cancelar antes de avançar automaticamente.
  const startNextCountdown = useCallback(() => {
    setNextCountdown(NEXT_COUNTDOWN_SECONDS);
    nextCountdownIntervalRef.current = setInterval(() => {
      // O updater faz APENAS o cálculo do próximo valor — nada de efeitos
      // colaterais aqui (como chamar goToNext/router.push), ou o React acusa
      // "Cannot update a component while rendering a different component".
      setNextCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return 0; // sinaliza "contagem terminou"; o avanço real acontece no useEffect abaixo
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Quando a contagem chega a 0, é seguro chamar goToNext (fora da fase de
  // render/reducer). Aqui também limpamos o interval, já que o updater acima
  // não faz mais isso.
  useEffect(() => {
    if (nextCountdown !== 0) return;
    if (nextCountdownIntervalRef.current) {
      clearInterval(nextCountdownIntervalRef.current);
      nextCountdownIntervalRef.current = null;
    }
    goToNext();
    setNextCountdown(null);
  }, [nextCountdown, goToNext]);

  // Reinicia o estado de reprodução sempre que o vídeo atual muda.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(true);
    setPlaybackRate(velocidadePreferida);
    cancelNextCountdown();
    if (videoRef.current) {
      videoRef.current.load();
      // `load()` repõe a velocidade a 1 — só depois se aplica a preferida.
      videoRef.current.defaultPlaybackRate = velocidadePreferida;
      videoRef.current.playbackRate = velocidadePreferida;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.fileUrl, current.externalUrl]);

  const alterarVelocidade = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // Picture-in-picture indisponível neste browser/vídeo — ignora.
    }
  }, []);

  // Sincroniza o estado de PiP com eventos nativos do <video> (ex: o utilizador
  // sai do ecrã flutuante a partir dos controlos do próprio sistema operativo).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    el.addEventListener("enterpictureinpicture", onEnter);
    el.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      el.removeEventListener("enterpictureinpicture", onEnter);
      el.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  // Garante que o intervalo é limpo se o componente for desmontado a meio da contagem.
  useEffect(() => {
    return () => {
      if (nextCountdownIntervalRef.current) {
        clearInterval(nextCountdownIntervalRef.current);
      }
    };
  }, []);

  // --- Controles ---
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    // O estado será atualizado pelos eventos 'play'/'pause'
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    // Usa sempre a duração real do elemento <video>, não o estado `duration` do React
    // (que só é atualizado no 'loadedmetadata' e pode ficar desatualizado). Alguns
    // ficheiros reportam `duration` como NaN antes do 'durationchange' disparar — nesse
    // caso, Math.min(x, NaN) devolve NaN, e atribuir currentTime = NaN faz o browser
    // reiniciar o vídeo para 0, dando a falsa sensação de que o botão "avançar" recua.
    const videoDuration = videoRef.current.duration;
    const safeDuration = Number.isFinite(videoDuration) ? videoDuration : Infinity;
    const newTime = videoRef.current.currentTime + seconds;
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, safeDuration));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const newTime = x * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  // --- Event listeners do vídeo ---
  const onPlay = () => {
    setIsPlaying(true);
    reproduziuRef.current = true;
    aoIniciarReproducaoParaView();
  };
  const onPause = () => {
    setIsPlaying(false);
    pararContagemView();
    guardarPosicao();
  };
  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    tempoAtualRef.current = t;
    // Guarda a posição a cada ~15s de reprodução (ou depois de um salto).
    if (reproduziuRef.current && !videoRef.current.paused && Math.abs(t - ultimaPosicaoGuardadaRef.current) >= 15) {
      guardarPosicao();
    }
    if (isDragging) return;
    setCurrentTime(t);
  };
  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
      aplicarPosicaoPendente();
    } else if (d === Infinity) {
      // Bug conhecido do browser: alguns ficheiros (ex: gravados em streaming,
      // sem caixa de duração no cabeçalho) só reportam a duração real depois
      // de uma procura. Força-a sem o utilizador ver o salto — é esta a causa
      // mais comum de "não aparece a duração do vídeo".
      const onSeeked = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
        video.currentTime = 0;
        video.removeEventListener("seeked", onSeeked);
        aplicarPosicaoPendente();
      };
      video.addEventListener("seeked", onSeeked);
      video.currentTime = 1e101;
    }
    setIsLoading(false);
  };
  // Em alguns browsers/ficheiros a duração só fica disponível mais tarde —
  // `durationchange` dispara sempre que isso acontece, mesmo depois do 'loadedmetadata'.
  const onDurationChange = () => {
    if (!videoRef.current) return;
    const d = videoRef.current.duration;
    if (Number.isFinite(d) && d > 0) setDuration(d);
  };
  const onWaiting = () => setIsLoading(true);
  const onCanPlay = () => {
    setIsLoading(false);
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  const onEnded = () => {
    setIsPlaying(false);
    pararContagemView();
    // Terminou: o servidor guarda 0, para a próxima vez começar do início.
    if (videoRef.current) tempoAtualRef.current = videoRef.current.duration || tempoAtualRef.current;
    guardarPosicao();
    // Com loop ativo, o próprio atributo `loop` do <video> trata da repetição
    // e este evento nem chega a disparar na maioria dos browsers — mas mantemos
    // esta verificação por segurança.
    if (isLooping) return;
    // Ao terminar, inicia uma contagem regressiva de 5s antes de avançar
    // automaticamente para o próximo vídeo, dando tempo ao utilizador para cancelar.
    // Só se a preferência "passar à aula seguinte" estiver ligada.
    if (canGoNext && autoplayProximaAula) {
      startNextCountdown();
    }
  };
  const onError = () => {
    setIsLoading(false);
    console.error("Erro no vídeo");
  };

  // --- Controles automáticos (esconder após inatividade) ---
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const container = containerRef.current;
    if (!container) return;

    const show = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    container.addEventListener("mousemove", show);
    container.addEventListener("mouseenter", show);
    container.addEventListener("touchstart", show);

    show();

    return () => {
      clearTimeout(timeout);
      container.removeEventListener("mousemove", show);
      container.removeEventListener("mouseenter", show);
      container.removeEventListener("touchstart", show);
    };
  }, []);

  // --- Fullscreen change ---
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // --- Atalhos de teclado ---
  useEffect(() => {
    // Verifica se o alvo do evento é um campo de escrita (input, textarea, select,
    // contentEditable) ou está dentro de uma zona explicitamente marcada como
    // "sem atalhos do player" (ex: caixa de comentários), para não conflituar
    // com outros componentes que também escutam teclas como espaço, setas, f, m, n, p.
    const isTypingOrExcludedTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT") {
        // O slider de volume também é um <input>, mas não é "escrita" — ficar
        // com foco nele (depois de arrastar) não deve desligar os atalhos do
        // player (bug persistente: espaço/setas/F deixavam de responder).
        return (target as HTMLInputElement).type !== "range";
      }
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      if (target.closest('[contenteditable="true"]')) return true;
      if (target.closest("[data-video-shortcuts-disabled]")) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingOrExcludedTarget(e.target)) return; // ignora inputs/textareas/contentEditable/zonas excluídas
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(+10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "n":
        case "N":
          e.preventDefault();
          if (canGoNext) goToNext();
          break;
        case "p":
        case "P":
          e.preventDefault();
          if (canGoPrevious) goToPrevious();
          break;
        case "l":
        case "L":
          e.preventDefault();
          setIsLooping((prev) => !prev);
          break;
        case "c":
        case "C":
          e.preventDefault();
          setLegendasVisiveis((v) => !v);
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, canGoNext, canGoPrevious, goToNext, goToPrevious]);

  // --- Auto-play inicial (após carregar) ---
  useEffect(() => {
    if (videoRef.current && autoPlay && !isLoading) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, isLoading]);

  // --- Formatação ---
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Botões de navegação entre vídeos (reutilizados nos três estados: externo, indisponível e normal)
  const NavButtons = ({ variant = "default" }: { variant?: "default" | "compact" }) => (
    <div className={cn("flex items-center gap-2", variant === "compact" && "gap-1")}>
      <button
        onClick={goToPrevious}
        disabled={!canGoPrevious}
        className={cn(
          "p-1.5 rounded-full transition text-white",
          canGoPrevious ? "hover:bg-white/20" : "opacity-30 cursor-not-allowed"
        )}
        aria-label="Vídeo anterior"
        title="Vídeo anterior"
      >
        <ChevronsLeft className="h-5 w-5" />
      </button>
      <button
        onClick={goToNext}
        disabled={!canGoNext}
        className={cn(
          "p-1.5 rounded-full transition text-white",
          canGoNext ? "hover:bg-white/20" : "opacity-30 cursor-not-allowed"
        )}
        aria-label="Próximo vídeo"
        title="Próximo vídeo"
      >
        <ChevronsRight className="h-5 w-5" />
      </button>
    </div>
  );

  // --- Vídeo externo (YouTube/Vimeo) ---
  if (current.externalUrl) {
    return (
      <div ref={containerRef} className={cn("relative w-full aspect-video bg-black group", className)}>
        <iframe
          src={current.externalUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={current.title || "Vídeo externo"}
        />
        {(canGoNext || canGoPrevious) && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <NavButtons variant="compact" />
          </div>
        )}
      </div>
    );
  }

  if (!current.fileUrl) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 bg-black/10 aspect-video", className)}>
        <p className="text-muted-foreground text-sm">Vídeo indisponível</p>
        {(canGoNext || canGoPrevious) && (
          <div className="flex items-center gap-2 text-foreground">
            <button
              onClick={goToPrevious}
              disabled={!canGoPrevious}
              className={cn(
                "p-1.5 rounded-full border transition",
                canGoPrevious ? "hover:bg-black/10" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Vídeo anterior"
            >
              <ChevronsLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                "p-1.5 rounded-full border transition",
                canGoNext ? "hover:bg-black/10" : "opacity-30 cursor-not-allowed"
              )}
              aria-label="Próximo vídeo"
            >
              <ChevronsRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full aspect-video bg-black group overflow-hidden", className)}
    >
      {/* Vídeo */}
      <video
        ref={videoRef}
        src={current.fileUrl}
        poster={current.thumbnail || undefined}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onWaiting={onWaiting}
        onCanPlay={onCanPlay}
        onEnded={onEnded}
        onError={onError}
        controlsList="nodownload noremoteplayback"
        playsInline
        preload="metadata"
        loop={isLooping}
      >
        {legendaUrl && (
          <track kind="subtitles" srcLang="pt" label="Português" src={legendaUrl} default={legendasVisiveis} />
        )}
      </video>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <LoaderCircle className="h-14 w-14 animate-spin text-white/80" />
        </div>
      )}

      {/* Aviso "a retomar de mm:ss" ao reabrir um vídeo a meio */}
      {retomadoEm !== null && nextCountdown === null && (
        <div className="absolute left-1/2 top-12 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/75 px-4 py-2 text-xs text-white shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-1">
          <span>A retomar de {formatTime(retomadoEm)}</span>
          <button
            type="button"
            onClick={recomecarDoInicio}
            className="font-semibold text-[#e2b45c] hover:underline underline-offset-2"
          >
            Recomeçar
          </button>
        </div>
      )}

      {/* Contagem regressiva antes de avançar automaticamente para o próximo vídeo */}
      {nextCountdown !== null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm px-6 text-center text-white">
          {!isControlledNav && queue[0]?.thumbnail && (
            <img
              src={queue[0].thumbnail}
              alt=""
              className="h-24 w-40 rounded-lg object-cover"
            />
          )}
          <p className="text-sm text-white/60">A seguir</p>
          {!isControlledNav && queue[0]?.title && (
            <p className="max-w-xs font-medium line-clamp-1">{queue[0].title}</p>
          )}
          <p className="text-4xl font-bold tabular-nums">{nextCountdown}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={cancelNextCountdown}
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                cancelNextCountdown();
                goToNext();
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            >
              Reproduzir agora
            </button>
          </div>
        </div>
      )}

      {/* Controles overlay */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-black/20 p-4 transition-opacity duration-300",
          showControls && !isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Título (topo) */}
        {current.title && (
          <div className="text-white text-sm font-medium drop-shadow-lg line-clamp-1 max-w-[80%]">
            {current.title}
          </div>
        )}

        {/* Botões centrais: trocar vídeo (extremos) · recuar/avançar 10s · play/pause (centro) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 sm:gap-3">
          {/* Vídeo anterior */}
          <button
            onClick={goToPrevious}
            disabled={!canGoPrevious}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition text-white",
              canGoPrevious
                ? "bg-white/10 border-white/20 hover:bg-white/25 hover:scale-105 active:scale-95"
                : "bg-white/5 border-white/10 opacity-40 cursor-not-allowed"
            )}
            aria-label="Vídeo anterior"
            title={canGoPrevious ? "Vídeo anterior" : "Ainda não há vídeo anterior"}
          >
            <ChevronsLeft className="h-6 w-6" />
          </button>

          {/* Separador visual entre "trocar vídeo" e "avançar/recuar 10s" */}
          <span className="h-8 w-px bg-white/15" aria-hidden />

          {/* Recuar 10s */}
          <button
            onClick={() => skip(-10)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 transition text-white"
            aria-label="Recuar 10 segundos"
            title="Recuar 10 segundos"
          >
            <SkipBack className="h-5 w-5" />
            <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
              10
            </span>
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:scale-110 active:scale-100 transition-transform duration-200"
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 fill-white" />
            ) : (
              <Play className="h-8 w-8 fill-white ml-1" />
            )}
          </button>

          {/* Avançar 10s */}
          <button
            onClick={() => skip(10)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 transition text-white"
            aria-label="Avançar 10 segundos"
            title="Avançar 10 segundos"
          >
            <SkipForward className="h-5 w-5" />
            <span className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
              10
            </span>
          </button>

          {/* Separador visual entre "avançar/recuar 10s" e "trocar vídeo" */}
          <span className="h-8 w-px bg-white/15" aria-hidden />

          {/* Próximo vídeo */}
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition text-white",
              canGoNext
                ? "bg-white/10 border-white/20 hover:bg-white/25 hover:scale-105 active:scale-95"
                : "bg-white/5 border-white/10 opacity-40 cursor-not-allowed"
            )}
            aria-label="Próximo vídeo"
            title={canGoNext ? "Próximo vídeo" : "Sem sugestões disponíveis"}
          >
            <ChevronsRight className="h-6 w-6" />
          </button>
        </div>

        {/* Barra inferior */}
        <div className="space-y-3">
          {/* Progresso */}
          <div
            ref={progressRef}
            className="relative w-full h-1.5 bg-white/30 rounded-full cursor-pointer hover:h-2 transition-all"
            onClick={handleProgressClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          {/* Controles inferiores */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-full hover:bg-white/20 transition"
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              <span className="text-xs font-mono tabular-nums">
                {formatTime(currentTime)}
                {duration > 0 && (
                  <span className="text-white/50"> / {formatTime(duration)}</span>
                )}
              </span>

              <div className="flex items-center gap-1 group/volume">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-full hover:bg-white/20 transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 accent-white cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {legendaUrl && (
                <button
                  onClick={() => setLegendasVisiveis((v) => !v)}
                  className={cn(
                    "p-1.5 rounded-full transition text-white",
                    legendasVisiveis ? "bg-white/30" : "hover:bg-white/20"
                  )}
                  aria-label={legendasVisiveis ? "Esconder legendas" : "Mostrar legendas"}
                  aria-pressed={legendasVisiveis}
                  title={legendasVisiveis ? "Esconder legendas (C)" : "Mostrar legendas (C)"}
                >
                  <Captions className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsLooping((prev) => !prev)}
                className={cn(
                  "p-1.5 rounded-full transition",
                  isLooping ? "bg-white/30 text-white" : "hover:bg-white/20 text-white"
                )}
                aria-label={isLooping ? "Desativar repetição" : "Repetir vídeo"}
                aria-pressed={isLooping}
                title={isLooping ? "Repetição ativada" : "Repetir vídeo"}
              >
                <Repeat className="h-4 w-4" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1.5 rounded-full hover:bg-white/20 transition text-white"
                    aria-label="Mais opções"
                    title="Mais opções"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                    <Gauge className="h-3.5 w-3.5" /> Velocidade
                  </DropdownMenuLabel>
                  {VELOCIDADES.map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onSelect={() => alterarVelocidade(rate)}
                      className="justify-between"
                    >
                      {rate === 1 ? "Normal" : `${rate}x`}
                      {playbackRate === rate && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  ))}
                  {pipDisponivel && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void togglePiP()} className="gap-2">
                        <PictureInPicture2 className="h-3.5 w-3.5" />
                        {isPiP ? "Sair do ecrã flutuante" : "Ecrã flutuante (PiP)"}
                      </DropdownMenuItem>
                    </>
                  )}
                  {estadoOffline !== "indisponivel" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => void alternarOffline()}
                        disabled={estadoOffline === "a-guardar"}
                        className="gap-2"
                      >
                        {estadoOffline === "sim" ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : (
                          <HardDriveDownload className="h-3.5 w-3.5" />
                        )}
                        {estadoOffline === "sim"
                          ? "Remover do modo offline"
                          : estadoOffline === "a-guardar"
                            ? "A guardar para offline…"
                            : "Guardar para ver offline"}
                      </DropdownMenuItem>
                    </>
                  )}
                  {recursos.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5" /> Recursos
                      </DropdownMenuLabel>
                      {recursos.map((recurso) => (
                        <DropdownMenuItem key={recurso.id} asChild className="gap-2">
                          <a
                            href={mediaUrl(recurso.arquivoUrl) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Download className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{recurso.nome}</span>
                          </a>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-full hover:bg-white/20 transition"
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}