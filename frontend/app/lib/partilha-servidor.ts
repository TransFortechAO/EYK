// Só no servidor (metadados e imagens de pré-visualização dos links partilhados).
// Os robôs das redes sociais não executam JavaScript nem têm sessão: leem as
// etiquetas <meta property="og:…"> do HTML e a imagem gerada em opengraph-image.
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { DadosPartilha } from "@/lib/api";

/** Endereço do Django visto do servidor do Next (no Render: API_INTERNO). */
function baseApi(): string {
  const interno = (process.env.API_INTERNO || "").trim().replace(/\/$/, "");
  if (interno) return /^https?:\/\//.test(interno) ? interno : `http://${interno}`;
  const publico = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//.test(publico)) return publico.replace(/\/api$/, "");
  return "http://localhost:8000";
}

export async function obterPartilha(tipo: DadosPartilha["tipo"], id: string): Promise<DadosPartilha | null> {
  if (!/^\d+$/.test(id)) return null;
  try {
    const res = await fetch(`${baseApi()}/api/partilha/${tipo}/${id}/`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as DadosPartilha;
  } catch {
    return null;
  }
}

/** URL absoluto de uma imagem do Django (capa), para o servidor a ir buscar. */
export function imagemAbsoluta(caminho: string | null): string | null {
  if (!caminho) return null;
  return /^https?:\/\//.test(caminho) ? caminho : `${baseApi()}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

/** Endereço público do site (para as etiquetas og:url e og:image). */
async function baseSite(): Promise<URL> {
  const definido = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (definido) return new URL(definido);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return new URL(`${proto}://${host}`);
}

const ROTULO: Record<DadosPartilha["tipo"], string> = {
  post: "Publicação",
  video: "Vídeo",
  curso: "Curso",
};

/** Metadados Open Graph/Twitter de um link partilhado; a imagem vem de opengraph-image. */
export async function metadadosPartilha(
  tipo: DadosPartilha["tipo"],
  id: string,
  caminho: string,
): Promise<Metadata> {
  const dados = await obterPartilha(tipo, id);
  const base = await baseSite();
  if (!dados) return { metadataBase: base, title: "EYK" };
  const titulo = tipo === "post" ? dados.titulo : `${dados.titulo} · ${ROTULO[tipo]} EYK`;
  const descricao = dados.descricao || `${ROTULO[tipo]} de ${dados.autor} na plataforma EYK.`;
  return {
    metadataBase: base,
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: caminho,
      siteName: "EYK — Ekola Ya Kelela",
      type: tipo === "video" ? "video.other" : "article",
      locale: "pt_PT",
    },
    twitter: { card: "summary_large_image", title: titulo, description: descricao },
  };
}
