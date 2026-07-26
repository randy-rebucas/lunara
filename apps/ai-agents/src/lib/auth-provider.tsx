'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initAuthSession } from './ai-agents-api';

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isReady: false, isAuthenticated: false });

export function AiAgentsAuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(initAuthSession());
    setIsReady(true);
  }, []);

  return <AuthContext.Provider value={{ isReady, isAuthenticated }}>{children}</AuthContext.Provider>;
}

export function useAiAgentsAuth() {
  return useContext(AuthContext);
}
