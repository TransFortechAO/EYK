import type { Metadata } from "next";
import { metadadosPartilha } from "@/lib/partilha-servidor";
import { AbrirPost } from "./abrir-post";

// Link de partilha de uma publicação: as redes sociais leem daqui o título e a
// imagem (opengraph-image.tsx); quem abre o link vai para a publicação na comunidade.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return metadadosPartilha("post", id, `/comunidade/post/${id}`);
}

export default async function PostPartilhadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AbrirPost id={id} />;
}
