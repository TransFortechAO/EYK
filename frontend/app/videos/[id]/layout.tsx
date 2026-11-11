import type { Metadata } from "next";
import { metadadosPartilha } from "@/lib/partilha-servidor";

// Título, descrição e imagem (opengraph-image.tsx) do link quando é partilhado noutras redes.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return metadadosPartilha("video", id, `/videos/${id}`);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
