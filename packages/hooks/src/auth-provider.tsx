'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthTokens, User } from '@lunara/types';
import { createApiClient } from './api-client';
import { resolveApiV1BaseUrl } from './api-url';

const STORAGE_KEY = 'lunara_auth';

interface AuthData {
  user: User;
  tokens: AuthTokens;
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  register: (data: {
    email?: string;
    phone?: string;
    password?: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ devOtp?: string }>;
  logout: () => Promise<void>;
  api: ReturnType<typeof createApiClient>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getApiUrl() {
  return resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setAuth(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((data: AuthData | null) => {
    setAuth(data);
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleUnauthorized = useCallback(() => {
    persist(null);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }, [persist]);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: getApiUrl(),
        getAccessToken: () => auth?.tokens.accessToken ?? null,
        onUnauthorized: handleUnauthorized,
      }),
    [auth?.tokens.accessToken, handleUnauthorized],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Login failed');
      persist({ user: body.data.user, tokens: body.data.tokens });
    },
    [persist],
  );

  const loginWithOtp = useCallback(
    async (phone: string, otp: string) => {
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Login failed');
      persist({ user: body.data.user, tokens: body.data.tokens });
    },
    [persist],
  );

  const register = useCallback(
    async (data: {
      email?: string;
      phone?: string;
      password?: string;
      firstName: string;
      lastName: string;
    }) => {
      const res = await fetch(`${getApiUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Registration failed');
      persist({ user: body.data.user, tokens: body.data.tokens });
    },
    [persist],
  );

  const requestOtp = useCallback(async (phone: string) => {
    const res = await fetch(`${getApiUrl()}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    if (!body.success) throw new Error('Failed to send OTP');
    return { devOtp: body.data.devOtp };
  }, []);

  const logout = useCallback(async () => {
    if (auth?.tokens.accessToken) {
      await fetch(`${getApiUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.tokens.accessToken}` },
      }).catch(() => {});
    }
    persist(null);
  }, [auth, persist]);

  const value: AuthContextValue = {
    user: auth?.user ?? null,
    tokens: auth?.tokens ?? null,
    isAuthenticated: !!auth,
    isLoading,
    login,
    loginWithOtp,
    register,
    requestOtp,
    logout,
    api,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
