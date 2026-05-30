import { useCallback, useState } from 'react';
import type { AuthTokens, User } from '@lunara/types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
  });

  const login = useCallback((user: User, tokens: AuthTokens) => {
    setState({ user, tokens, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, tokens: null, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}
