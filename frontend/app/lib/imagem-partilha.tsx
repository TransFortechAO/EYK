// Imagem de pré-visualização (1200×630) dos links partilhados noutras redes.
// Vídeos e cursos: a capa que aparece na plataforma, com o título por cima.
// Publicações da comunidade: um cartão com as cores da EYK.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { DadosPartilha } from "@/lib/api";
import { thumbnailFor } from "@/lib/capas";
import { imagemAbsoluta, obterPartilha } from "@/lib/partilha-servidor";

export const TAMANHO_PARTILHA = { width: 1200, height: 630 };

const DOURADO = "#B8892F";
const DOURADO_CLARO = "#E8C878";
const CREME = "#FBF6EC";
const TINTA = "#1F1A12";

async function logo(): Promise<string | null> {
  try {
    const ficheiro = await readFile(path.join(process.cwd(), "public/assets/EYK_-_LOGO-SEM-BAKGROUND.png"));
    return `data:image/png;base64,${ficheiro.toString("base64")}`;
  } catch {
    return null;
  }
}

/** A imagem só entra se o servidor a conseguir ir buscar (senão fica o gradiente). */
async function capaDisponivel(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "HEAD", next: { revalidate: 300 } });
    // O gerador só lê PNG, JPEG e GIF; noutros formatos (ex: WebP) fica sem a foto.
    return res.ok && /^image\/(png|jpe?g|gif)/.test(res.headers.get("content-type") ?? "") ? url : null;
  } catch {
    return null;
  }
}

function Selo({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={150} height={90} style={{ objectFit: "contain" }} />
  ) : (
    <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: DOURADO }}>EYK</div>
  );
}

function ImagemConteudo({ dados, id, capa, selo }: { dados: DadosPartilha; id: string; capa: string | null; selo: string | null }) {
  const rotulo = dados.tipo === "video" ? "Vídeo" : "Curso";
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", backgroundImage: thumbnailFor(id) }}>
      {capa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capa} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
      )}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.82) 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              borderRadius: 999,
              background: "rgba(251,246,236,0.94)",
              color: TINTA,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {dados.categoria ? `${rotulo} · ${dados.categoria}` : rotulo}
          </div>
          <div style={{ display: "flex", padding: "6px 14px", borderRadius: 20, background: "rgba(251,246,236,0.94)" }}>
            <Selo src={selo} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.08, maxWidth: 1060 }}>
            {dados.titulo.length > 70 ? `${dados.titulo.slice(0, 69)}…` : dados.titulo}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: DOURADO_CLARO, fontWeight: 600 }}>
            {dados.autor} · EYK — Ekola Ya Kelela
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagemPost({ dados, selo, foto }: { dados: DadosPartilha; selo: string | null; foto: string | null }) {
  const maximo = foto ? 120 : 200;
  const texto = dados.descricao.length > maximo ? `${dados.descricao.slice(0, maximo - 1)}…` : dados.descricao;
  const iniciais = dados.autor
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 56,
        gap: 28,
        backgroundImage: `linear-gradient(135deg, ${DOURADO} 0%, ${DOURADO_CLARO} 100%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: foto ? 620 : "100%",
          height: "100%",
          padding: "44px 52px",
          borderRadius: 36,
          background: CREME,
          color: TINTA,
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 999,
              backgroundImage: `linear-gradient(135deg, ${DOURADO}, ${DOURADO_CLARO})`,
              color: "white",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            {iniciais || "?"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>{dados.autor}</div>
            <div style={{ display: "flex", fontSize: 24, color: "#7A6A4F" }}>na comunidade EYK</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: foto ? 32 : 40, lineHeight: 1.35, fontWeight: 500 }}>
          {texto ? `“${texto}”` : "Uma publicação na comunidade EYK"}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: DOURADO, fontWeight: 700 }}>
            Aprende LGA e muito mais em comunidade
          </div>
          <Selo src={selo} />
        </div>
      </div>
      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" width={440} height={518} style={{ objectFit: "cover", borderRadius: 28 }} />
      )}
    </div>
  );
}

/** Gera a imagem de pré-visualização; se o conteúdo não existir, uma imagem genérica da EYK. */
export async function imagemPartilha(tipo: DadosPartilha["tipo"], id: string): Promise<ImageResponse> {
  const [dados, selo] = await Promise.all([obterPartilha(tipo, id), logo()]);
  let conteudo: React.ReactElement;
  if (!dados) {
    conteudo = (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: CREME,
        }}
      >
        <Selo src={selo} />
      </div>
    );
  } else if (dados.tipo === "post") {
    const foto = await capaDisponivel(imagemAbsoluta(dados.imagem));
    conteudo = <ImagemPost dados={dados} selo={selo} foto={foto} />;
  } else {
    const capa = await capaDisponivel(imagemAbsoluta(dados.imagem));
    conteudo = <ImagemConteudo dados={dados} id={id} capa={capa} selo={selo} />;
  }
  return new ImageResponse(conteudo, TAMANHO_PARTILHA);
}
