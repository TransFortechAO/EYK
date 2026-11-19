/**
 * Comprime um vídeo no próprio browser antes de o enviar (WebCodecs, via Mediabunny).
 *
 * Os vídeos de telemóvel vêm em 1080p/4K com 60–200 MB por minuto. Para língua gestual,
 * 720p em H.264 a ~2 Mbps chega para ver bem as mãos e a cara, e o ficheiro fica 5 a 10
 * vezes mais pequeno: o envio demora proporcionalmente menos, seja qual for a ligação.
 *
 * Nunca impede o envio: se o browser não souber comprimir, se o vídeo já for leve ou se
 * algo falhar, devolve o ficheiro original.
 */

/** Lado curto do vídeo comprimido (720 = 1280×720 na horizontal, 720×1280 na vertical). */
export const LADO_CURTO = 720;
export const BITRATE_VIDEO = 2_000_000;
export const BITRATE_AUDIO = 96_000;
/** Abaixo disto já não compensa o tempo de comprimir. */
const TAMANHO_MINIMO = 15 * 1024 * 1024;
/** Só compensa comprimir se o ficheiro ficar bem mais pequeno (pelo menos ~2,5×): comprimir
 * também leva tempo (medido: ~1,7× a duração do vídeo sem aceleração por hardware). Os
 * vídeos de telemóvel (1080p/4K, 15–50 Mbps) passam largamente; gravações já leves não. */
const BITRATE_MINIMO_PARA_COMPRIMIR = 5_000_000;
/** O resultado fica em memória até ser enviado: vídeos muito longos seguem tal como estão. */
const DURACAO_MAXIMA_SEG = 60 * 60;

export type AoComprimir = (percentagem: number) => void;

/** Dimensões de saída: o lado curto passa a 720 (nunca aumenta), sempre em números pares. */
export function dimensoesDeSaida(largura: number, altura: number, ladoCurto = LADO_CURTO): { largura: number; altura: number } {
  const curto = Math.min(largura, altura);
  const escala = curto > ladoCurto ? ladoCurto / curto : 1;
  const par = (n: number) => Math.max(2, Math.round((n * escala) / 2) * 2);
  return { largura: par(largura), altura: par(altura) };
}

/** Vale a pena comprimir? (tamanho e bitrate do original) */
export function precisaDeComprimir(tamanho: number, duracaoSeg: number): boolean {
  if (tamanho < TAMANHO_MINIMO || !duracaoSeg || duracaoSeg > DURACAO_MAXIMA_SEG) return false;
  return (tamanho * 8) / duracaoSeg >= BITRATE_MINIMO_PARA_COMPRIMIR;
}

function nomeMp4(nome: string): string {
  const base = nome.replace(/\.[^.]+$/, "") || "video";
  return `${base}.mp4`;
}

export async function comprimirVideo(ficheiro: File, aoComprimir?: AoComprimir): Promise<File> {
  if (typeof window === "undefined" || typeof VideoEncoder === "undefined" || ficheiro.size < TAMANHO_MINIMO) {
    return ficheiro;
  }
  let input: { dispose(): void } | null = null;
  try {
    const mb = await import("mediabunny");
    const entrada = new mb.Input({ source: new mb.BlobSource(ficheiro), formats: mb.ALL_FORMATS });
    input = entrada;
    const faixa = await entrada.getPrimaryVideoTrack();
    if (!faixa) return ficheiro;
    const duracao = await entrada.computeDuration();
    if (!precisaDeComprimir(ficheiro.size, duracao)) return ficheiro;

    const saida = dimensoesDeSaida(faixa.displayWidth, faixa.displayHeight);
    if (!(await mb.canEncodeVideo("avc", { width: saida.largura, height: saida.altura }))) {
      return ficheiro;
    }
    const destino = new mb.BufferTarget();
    const output = new mb.Output({
      // fastStart: o vídeo começa a tocar antes de descarregar todo (índice no início).
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: destino,
    });
    const conversao = await mb.Conversion.init({
      input: entrada,
      output,
      tracks: "primary",
      video: { width: saida.largura, height: saida.altura, fit: "contain", codec: "avc", bitrate: BITRATE_VIDEO },
      audio: { codec: "aac", bitrate: BITRATE_AUDIO },
    });
    if (!conversao.isValid) return ficheiro;
    if (aoComprimir) conversao.onProgress = (p: number) => aoComprimir(Math.round(p * 100));
    await conversao.execute();
    const buffer = destino.buffer;
    // Só compensa se poupar pelo menos 10%.
    if (!buffer || buffer.byteLength > ficheiro.size * 0.9) return ficheiro;
    return new File([buffer], nomeMp4(ficheiro.name), { type: "video/mp4", lastModified: Date.now() });
  } catch (erro) {
    console.warn("Não foi possível comprimir o vídeo; segue o original.", erro);
    return ficheiro;
  } finally {
    try {
      input?.dispose();
    } catch {
      /* já libertado */
    }
  }
}
