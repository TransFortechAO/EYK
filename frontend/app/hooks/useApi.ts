"use client";

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

type UseApiState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Erro desconhecido');
      setState({ data: null, loading: false, error: err });
      throw err;
    }
  }, []);

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, loading: false, error: null }),
  };
}

// Exemplos de uso:
// const { data: cursos, loading, error, execute } = useApi<any[]>();
// useEffect(() => {
//   execute(api.getCursos);
// }, [execute]);