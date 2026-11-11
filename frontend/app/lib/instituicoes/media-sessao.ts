// Vídeos escolhidos ou gravados, em memória até se publicar: nas instituições reais
// seguem então para o servidor; na demonstração desaparecem ao recarregar a página.
import { enderecoApi } from "./servidor";
import type { VideoAnexo } from "./tipos";

const urls = new Map<string, string>();
const ficheiros = new Map<string, File>();
let seq = 0;

/** Lê a duração de um vídeo no browser (null se não for possível). */
function lerDuracao(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

export async function guardarVideoSessao(ficheiro: File): Promise<VideoAnexo> {
  const url = URL.createObjectURL(ficheiro);
  seq += 1;
  const sessaoId = `vs-${Date.now()}-${seq}`;
  urls.set(sessaoId, url);
  ficheiros.set(sessaoId, ficheiro);
  return { nome: ficheiro.name, tamanhoBytes: ficheiro.size, duracaoSeg: await lerDuracao(url), sessaoId };
}

/** O vídeo no servidor (endereço protegido) ou, antes de publicar, o que está em memória. */
export function urlVideoSessao(video: VideoAnexo | null | undefined): string | null {
  if (video?.url) return enderecoApi(video.url) ?? null;
  return video?.sessaoId ? urls.get(video.sessaoId) ?? null : null;
}

/** O ficheiro escolhido, para o enviar ao servidor quando se publica. */
export function ficheiroDoVideo(video: VideoAnexo): File | null {
  return video.sessaoId ? ficheiros.get(video.sessaoId) ?? null : null;
}
