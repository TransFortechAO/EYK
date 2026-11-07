"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** O pedido para ser professor está agora no separador "Professor" do registo. */
export default function SerProfessorPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/register?tipo=professor");
  }, [router]);
  return null;
}
