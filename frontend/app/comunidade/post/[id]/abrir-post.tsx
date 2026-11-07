"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Leva quem abre o link partilhado para a publicação na comunidade (abre o modal do post). */
export function AbrirPost({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/inicio?post=${encodeURIComponent(id)}`);
  }, [id, router]);
  return <p className="py-10 text-center text-sm text-muted-foreground">A abrir a publicação…</p>;
}
