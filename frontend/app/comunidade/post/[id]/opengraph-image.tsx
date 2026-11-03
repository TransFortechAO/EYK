import { imagemPartilha, TAMANHO_PARTILHA } from "@/lib/imagem-partilha";

export const size = TAMANHO_PARTILHA;
export const contentType = "image/png";
export const alt = "Publicação na comunidade EYK";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return imagemPartilha("post", id);
}
