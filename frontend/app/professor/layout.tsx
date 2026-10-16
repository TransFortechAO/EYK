"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-gate";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (!user.isTeacher) {
      router.replace("/inicio");
    }
  }, [user, router]);

  if (!user?.isTeacher) return null;

  return <>{children}</>;
}
