"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { api, type AuthUser } from "@/lib/api";
import { aplicarPreferenciasVisuais } from "@/lib/preferencias-visuais";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
};

const initialState: AuthState = {
  loading: true,
  authenticated: false,
  user: null,
  refresh: async () => { },
};

const AuthContext = createContext<AuthState>(initialState);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  const load = async () => {
    try {
      const res = await api.me();
      const authenticated = Boolean(res?.ok && res?.authenticated && res?.user);
      setState((prev) => ({
        ...prev,
        loading: false,
        authenticated,
        user: authenticated ? (res.user as AuthUser) : null,
      }));
      if (!authenticated) {
        window.location.assign("/login");
      } else if (res.user?.preferencias) {
        // As preferências guardadas na conta mandam (podem ter sido mudadas
        // noutro dispositivo) — e ficam em cache para as páginas públicas.
        aplicarPreferenciasVisuais(res.user.preferencias);
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false, authenticated: false, user: null }));
      window.location.assign("/login");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setState((prev) => ({ ...prev, refresh: load }));
  }, []);

  if (state.loading) {
    return <AuthLoader />;
  }

  if (!state.authenticated) {
    // Não devia chegar aqui, mas caso aconteça não mostra nada.
    return null;
  }

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

function AuthLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-5">
        <div
          className="font-serif text-4xl font-bold tracking-tight"
          style={{ color: "#d4a24a" }}
        >
          <img src="/assets/EYK_-_LOGO-SEM-BAKGROUND.png" alt="logo-eyk" className="h-40 w-auto object-contain" />
        </div>
        <div className="w-10 h-10 border-2 rounded-full animate-spin border-[#d4a24a] border-t-transparent" />
        <p className="text-white/50 text-sm">A verificar sessão…</p>
      </div>
    </div>
  );
}
