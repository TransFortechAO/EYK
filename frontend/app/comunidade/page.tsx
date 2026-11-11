"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A Comunidade está agora no Início. Este endereço fica para os links antigos (partilhas,
 * notificações, favoritos): leva ao Início com o mesmo `?post=`.
 */
export default function ComunidadePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/inicio${window.location.search}`);
  }, [router]);
  return null;
}
