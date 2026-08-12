"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { api, type AuthUser } from "@/lib/api";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
};

const initialState: AuthState = {
  loading: true,
  authenticated: false,
  user: null,
};

const AuthContext = createContext<AuthState>(initialState);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        const authenticated = Boolean(res?.ok && res?.authenticated && res?.user);
        setState({
          loading: false,
          authenticated,
          user: authenticated ? (res.user as AuthUser) : null,
        });
        if (!authenticated) {
          window.location.assign("/login");
        }
      } catch {
        if (cancelled) return;
        setState({ loading: false, authenticated: false, user: null });
        window.location.assign("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
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
          EYK
        </div>
        <div className="w-10 h-10 border-2 rounded-full animate-spin border-[#d4a24a] border-t-transparent" />
        <p className="text-white/50 text-sm">A verificar sessão…</p>
      </div>
    </div>
  );
}
