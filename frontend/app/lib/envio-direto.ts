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

type LinkDeEnvio = {
  direto: boolean;
  id?: number;
  url?: string;
  metodo?: string;
  cabecalhos?: Record<string, string>;
};

// Uma vez que o bucket recuse (CORS por configurar), não se volta a tentar nesta página.
let diretoIndisponivel = false;
const ENVIOS_EM_SIMULTANEO = 3;

class SemEnvioDireto extends Error {}

function enviarParaLink(link: LinkDeEnvio, ficheiro: File, aoEnviar: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(link.metodo || "PUT", link.url!);
    Object.entries(link.cabecalhos || {}).forEach(([nome, valor]) => xhr.setRequestHeader(nome, valor));
    xhr.upload.onprogress = (e) => aoEnviar(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        aoEnviar(ficheiro.size);
        resolve();
      } else {
        reject(new Error(`Não foi possível enviar "${ficheiro.name}" para o armazenamento (erro ${xhr.status}). Tenta de novo.`));
      }
    };
    // Sem resposta nenhuma: quase sempre o CORS do bucket por configurar.
    xhr.onerror = () => reject(new SemEnvioDireto());
    xhr.send(ficheiro);
  });
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
  if (!link.direto || !link.url || !link.id) throw new SemEnvioDireto();
  await enviarParaLink(link, ficheiro, aoEnviar);
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
    if (erro instanceof SemEnvioDireto) {
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
        if (erro instanceof SemEnvioDireto) {
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
export function lerVideo(ficheiro: File, comCapa = true, limiteMs = 8000): Promise<InfoVideo> {
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
