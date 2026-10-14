// Vídeos guardados para ver sem internet (PWA). O ficheiro inteiro fica na
// Cache API ("eyk-videos-v1") e o service worker (public/sw.js) serve-o daí,
// com suporte a pedidos Range. O nome da cache tem de bater certo com o sw.js.

export const CACHE_VIDEOS = "eyk-videos-v1";
const INDICE_KEY = "eyk:videos-offline";

/** Limites da gravação AUTOMÁTICA (vídeos que o aluno já viu). A gravação
 * manual pelo menu do player ignora o limite de tamanho. */
export const MAX_VIDEOS_AUTOMATICOS = 10;
export const MAX_BYTES_AUTOMATICO = 150 * 1024 * 1024; // 150MB

export type VideoOffline = {
  url: string;
  titulo: string;
  bytes: number;
  guardadoEm: string;
  automatico: boolean;
};

export function offlineSuportado(): boolean {
  return typeof window !== "undefined" && "caches" in window && "serviceWorker" in navigator;
}

/** Só faz sentido guardar se houver um service worker a controlar a página —
 * é ele que serve os vídeos da cache quando não há rede. */
function swAtivo(): boolean {
  return offlineSuportado() && !!navigator.serviceWorker.controller;
}

function lerIndice(): VideoOffline[] {
  try {
    const raw = localStorage.getItem(INDICE_KEY);
    const lista = raw ? (JSON.parse(raw) as VideoOffline[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravarIndice(lista: VideoOffline[]) {
  try {
    localStorage.setItem(INDICE_KEY, JSON.stringify(lista));
  } catch {
    /* localStorage cheio/indisponível — o vídeo continua na cache */
  }
}

export function listarVideosOffline(): VideoOffline[] {
  return lerIndice();
}

export async function videoEstaOffline(url: string): Promise<boolean> {
  if (!offlineSuportado()) return false;
  try {
    const cache = await caches.open(CACHE_VIDEOS);
    return !!(await cache.match(url, { ignoreSearch: true }));
  } catch {
    return false;
  }
}

export async function removerVideoOffline(url: string): Promise<void> {
  if (!offlineSuportado()) return;
  const cache = await caches.open(CACHE_VIDEOS);
  await cache.delete(url, { ignoreSearch: true });
  gravarIndice(lerIndice().filter((v) => v.url !== url));
}

/** Utilizador pediu para poupar dados (definição do Android/Chrome "Poupança de dados"). */
function poupancaDeDados(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

async function tamanhoRemoto(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", mode: "cors", credentials: "omit" });
    const len = Number(res.headers.get("content-length"));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}

/**
 * Descarrega o vídeo inteiro para a cache. Lança erro se o servidor não
 * permitir (CORS) ou se não houver espaço. Devolve o nº de bytes guardados.
 */
export async function guardarVideoOffline(
  url: string,
  titulo: string,
  { automatico = false }: { automatico?: boolean } = {},
): Promise<number> {
  if (!offlineSuportado()) throw new Error("Este browser não suporta vídeos offline.");

  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Falha ao descarregar o vídeo (${res.status}).`);
  const blob = await res.blob();
  const cache = await caches.open(CACHE_VIDEOS);
  await cache.put(
    url,
    new Response(blob, {
      headers: {
        "Content-Type": res.headers.get("content-type") || blob.type || "video/mp4",
        "Content-Length": String(blob.size),
      },
    }),
  );

  const lista = lerIndice().filter((v) => v.url !== url);
  lista.push({ url, titulo, bytes: blob.size, guardadoEm: new Date().toISOString(), automatico });
  gravarIndice(lista);
  return blob.size;
}

/**
 * Guarda automaticamente um vídeo que o aluno já viu, se fizer sentido:
 * service worker ativo, sem "poupança de dados", ficheiro até 150MB. Mantém
 * só os últimos MAX_VIDEOS_AUTOMATICOS (os guardados à mão nunca são apagados).
 * Nunca lança erro — falhar aqui não pode afetar a reprodução.
 */
export async function guardarAutomaticamenteSeElegivel(url: string, titulo: string): Promise<boolean> {
  try {
    if (!swAtivo() || poupancaDeDados()) return false;
    if (await videoEstaOffline(url)) return false;
    const tamanho = await tamanhoRemoto(url);
    if (tamanho === null || tamanho > MAX_BYTES_AUTOMATICO) return false;

    const automaticos = lerIndice()
      .filter((v) => v.automatico)
      .sort((a, b) => a.guardadoEm.localeCompare(b.guardadoEm));
    const aRemover = automaticos.slice(0, Math.max(automaticos.length - MAX_VIDEOS_AUTOMATICOS + 1, 0));
    for (const v of aRemover) await removerVideoOffline(v.url);

    await guardarVideoOffline(url, titulo, { automatico: true });
    return true;
  } catch {
    return false;
  }
}

/** Apaga os dados da API guardados pelo service worker (são pessoais). */
export function limparCacheApiOffline() {
  if (!offlineSuportado()) return;
  navigator.serviceWorker.controller?.postMessage({ tipo: "limpar-cache-api" });
}
