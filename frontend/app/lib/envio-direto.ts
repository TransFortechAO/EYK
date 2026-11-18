/**
 * Envio direto de ficheiros para o armazenamento (Backblaze B2), sem passar pelo servidor.
 *
 * 1. Pede ao Django um link assinado (POST /api/professor/envios/).
 * 2. Envia o ficheiro para esse link (PUT), com progresso.
 * 3. Quem chama manda só o número do envio ao criar o vídeo ou o curso.
 *
 * Sem bucket (desenvolvimento) ou com o CORS do bucket por configurar, devolve `null`
 * e quem chama envia os ficheiros pelo servidor, como antes.
 */
import { fetchAPI } from "@/lib/api";

export type FinalidadeEnvio = "video" | "aula" | "recurso_curso" | "recurso_video";
/** Percentagem (0–100) do total de bytes já enviados. */
export type AoProgredir = (percentagem: number) => void;

type ParteDeEnvio = { numero: number; inicio: number; tamanho: number; url: string };

type LinkDeEnvio = {
  direto: boolean;
  id?: number;
  /** Ficheiro pequeno: um só PUT. */
  url?: string;
  metodo?: string;
  cabecalhos?: Record<string, string>;
  /** Ficheiro grande: um PUT por parte, em paralelo. */
  partes?: ParteDeEnvio[];
};

// Uma vez que o bucket recuse (CORS por configurar), não se volta a tentar nesta página.
let diretoIndisponivel = false;
const ENVIOS_EM_SIMULTANEO = 3;
// Partes do mesmo ficheiro em paralelo: várias ligações aproveitam melhor a largura de
// banda quando a latência até ao bucket é alta (Angola → Europa).
const PARTES_EM_SIMULTANEO = 4;
const TENTATIVAS = 3;

class SemEnvioDireto extends Error {}
/** Falha passageira (rede, 5xx): vale a pena repetir. */
class FalhaPassageira extends Error {}

let esperaEntreTentativasMs = 1000;
/** Só para os testes. */
export function _semEsperaEntreTentativas() {
  esperaEntreTentativasMs = 0;
}

async function comRepeticao<T>(fazer: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    try {
      return await fazer();
    } catch (erro) {
      if (!(erro instanceof FalhaPassageira)) throw erro;
      ultimo = erro;
      if (esperaEntreTentativasMs) await new Promise((r) => setTimeout(r, esperaEntreTentativasMs * 2 ** tentativa));
    }
  }
  throw ultimo;
}

/** Um PUT com progresso. Devolve o ETag (precisa dele para juntar as partes). */
function put(url: string, corpo: Blob, cabecalhos: Record<string, string>, aoEnviar: (bytes: number) => void, nome: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(cabecalhos).forEach(([n, v]) => xhr.setRequestHeader(n, v));
    xhr.upload.onprogress = (e) => aoEnviar(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        aoEnviar(corpo.size);
        resolve(xhr.getResponseHeader("ETag"));
      } else if (xhr.status >= 500 || xhr.status === 408 || xhr.status === 429) {
        aoEnviar(0);
        reject(new FalhaPassageira(`O armazenamento falhou ao receber "${nome}" (erro ${xhr.status}).`));
      } else {
        reject(new Error(`Não foi possível enviar "${nome}" para o armazenamento (erro ${xhr.status}). Tenta de novo.`));
      }
    };
    // Sem resposta nenhuma: rede em baixo ou o CORS do bucket por configurar.
    xhr.onerror = () => {
      aoEnviar(0);
      reject(new FalhaPassageira(`Falhou a ligação ao enviar "${nome}".`));
    };
    xhr.send(corpo);
  });
}

async function enviarPartes(link: LinkDeEnvio, ficheiro: File, aoEnviar: (bytes: number) => void): Promise<void> {
  const partes = link.partes!;
  const enviados = partes.map(() => 0);
  const etags: { numero: number; etag: string }[] = [];
  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < partes.length) {
      const i = proxima++;
      const parte = partes[i];
      const etag = await comRepeticao(() =>
        put(parte.url, ficheiro.slice(parte.inicio, parte.inicio + parte.tamanho), {}, (b) => {
          enviados[i] = b;
          aoEnviar(enviados.reduce((a, x) => a + x, 0));
        }, ficheiro.name),
      );
      // O servidor confirma as partes no próprio B2 (ListParts); o ETag é só informativo.
      etags.push({ numero: parte.numero, etag: etag || "" });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARTES_EM_SIMULTANEO, partes.length) }, trabalhador));
  await fetchAPI(`/api/professor/envios/${link.id}/concluir/`, { method: "POST", body: JSON.stringify({ partes: etags }) });
}

async function pedirLink(ficheiro: File, finalidade: FinalidadeEnvio): Promise<LinkDeEnvio> {
  return await fetchAPI<LinkDeEnvio>("/api/professor/envios/", {
    method: "POST",
    body: JSON.stringify({
      finalidade,
      nome: ficheiro.name,
      tamanho: ficheiro.size,
      tipo: ficheiro.type || "application/octet-stream",
    }),
  });
}

async function enviarUm(ficheiro: File, finalidade: FinalidadeEnvio, aoEnviar: (bytes: number) => void): Promise<number> {
  const link = await pedirLink(ficheiro, finalidade);
  if (!link.direto || !link.id || (!link.url && !link.partes)) throw new SemEnvioDireto();
  if (link.partes) {
    await enviarPartes(link, ficheiro, aoEnviar);
  } else {
    await comRepeticao(() => put(link.url!, ficheiro, link.cabecalhos || {}, aoEnviar, ficheiro.name));
  }
  return link.id;
}

/**
 * Envia os ficheiros direto para o armazenamento e devolve o número de cada envio, pela
 * mesma ordem. `null` = envio direto indisponível: envia-os pelo servidor.
 */
export async function enviarFicheiros(
  itens: { ficheiro: File; finalidade: FinalidadeEnvio }[],
  aoProgredir?: AoProgredir,
): Promise<number[] | null> {
  if (itens.length === 0) return [];
  if (diretoIndisponivel) return null;

  const total = itens.reduce((soma, i) => soma + i.ficheiro.size, 0) || 1;
  const enviados = itens.map(() => 0);
  const avisar = (indice: number) => (bytes: number) => {
    enviados[indice] = bytes;
    aoProgredir?.(Math.min(100, Math.round((enviados.reduce((a, b) => a + b, 0) / total) * 100)));
  };

  const ids: number[] = new Array(itens.length);
  try {
    // O primeiro diz se o envio direto funciona; os outros seguem em paralelo.
    ids[0] = await enviarUm(itens[0].ficheiro, itens[0].finalidade, avisar(0));
  } catch (erro) {
    if (erro instanceof SemEnvioDireto || erro instanceof FalhaPassageira) {
      diretoIndisponivel = true;
      return null;
    }
    throw erro;
  }

  let proximo = 1;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      try {
        ids[indice] = await enviarUm(itens[indice].ficheiro, itens[indice].finalidade, avisar(indice));
      } catch (erro) {
        if (erro instanceof SemEnvioDireto || erro instanceof FalhaPassageira) {
          throw new Error(`Falhou a ligação ao enviar "${itens[indice].ficheiro.name}". Verifica a internet e tenta de novo.`);
        }
        throw erro;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ENVIOS_EM_SIMULTANEO, itens.length - 1) }, trabalhador));
  return ids;
}

/** Só para os testes. */
export function _reporEnvioDireto() {
  diretoIndisponivel = false;
}

export type InfoVideo = { duracao: number; capa: File | null };

/**
 * Duração e uma capa (imagem ao segundo 1), lidas no próprio browser. Assim o servidor
 * não precisa de descarregar o vídeo do armazenamento para as saber. Se o browser não
 * conseguir ler o formato, devolve {0, null} e o servidor trata disso.
 */
export function lerVideo(ficheiro: File, comCapa = true, limiteMs = 5000): Promise<InfoVideo> {
  if (typeof document === "undefined") return Promise.resolve({ duracao: 0, capa: null });
  return new Promise((resolve) => {
    const url = URL.createObjectURL(ficheiro);
    const video = document.createElement("video");
    let duracao = 0;
    let terminado = false;
    const fim = (capa: File | null) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(relogio);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve({ duracao: Math.round(duracao), capa });
    };
    const relogio = setTimeout(() => fim(null), limiteMs);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => fim(null);
    video.onloadedmetadata = () => {
      duracao = Number.isFinite(video.duration) ? video.duration : 0;
      if (!comCapa || !duracao) return fim(null);
      video.currentTime = Math.min(1, duracao * 0.1);
    };
    video.onseeked = () => {
      const largura = Math.min(video.videoWidth || 0, 1280);
      if (!largura) return fim(null);
      const altura = Math.round((video.videoHeight / video.videoWidth) * largura);
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fim(null);
      ctx.drawImage(video, 0, 0, largura, altura);
      canvas.toBlob(
        (blob) => fim(blob ? new File([blob], "capa.jpg", { type: "image/jpeg" }) : null),
        "image/jpeg",
        0.8,
      );
    };
    video.src = url;
  });
}
