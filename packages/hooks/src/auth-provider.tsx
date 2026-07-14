'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AuthTokens, User } from '@lunara/types';
import { formatPhone } from '@lunara/utils';
import { createApiClient } from './api-client';
import { resolveApiV1BaseUrl } from './api-url';

function parseAuthError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as Record<string, unknown>;
  if (record.error && typeof record.error === 'object') {
    const message = (record.error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  if (Array.isArray(record.message) && record.message.length > 0) return String(record.message[0]);
  return fallback;
}

const STORAGE_KEY = 'lunara_auth';
const REFRESH_BUFFER_MS = 60_000;

interface AuthData {
  user: User;
  tokens: AuthTokens;
  /** Access token expiry (epoch ms). */
  expiresAt: number;
}

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  signupWithOtp: (phone: string, otp: string) => Promise<void>;
  register: (data: {
    email?: string;
    phone?: string;
    password?: string;
    firstName: string;
    lastName: string;
    referralCode?: string;
  }) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ phone: string }>;
  logout: () => Promise<void>;
  api: ReturnType<typeof createApiClient>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getApiUrl() {
  return resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
}

const TENANT_COOKIE = 'lunara_partner_id';

/** Reads the partner tenant id set by customer-web's middleware when running under a white-labeled domain. */
function getTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TENANT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function authDataFromSession(user: User, tokens: AuthTokens): AuthData {
  return {
    user,
    tokens,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
}

function hydrateStoredAuth(raw: unknown): AuthData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AuthData>;
  if (!data.user || !data.tokens?.accessToken || !data.tokens.refreshToken) return null;
  const expiresAt =
    typeof data.expiresAt === 'number'
      ? data.expiresAt
      : Date.now() + (data.tokens.expiresIn ?? 3600) * 1000;
  return { user: data.user, tokens: data.tokens, expiresAt };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRef = useRef(auth);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const hydrated = hydrateStoredAuth(JSON.parse(stored));
        if (hydrated) setAuth(hydrated);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((data: AuthData | null) => {
    setAuth(data);
    authRef.current = data;
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleUnauthorized = useCallback(() => {
    persist(null);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }, [persist]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const current = authRef.current;
    if (!current?.tokens.refreshToken) {
      throw new Error('No refresh token');
    }

    const task = (async () => {
      const res = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
      });
      const body = await res.json();
      if (!body.success) {
        throw new Error(body.error?.message ?? 'Session expired');
      }
      persist(authDataFromSession(body.data.user ?? current.user, body.data.tokens));
    })();

    refreshInFlightRef.current = task;
    try {
      await task;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [persist]);

  useEffect(() => {
    if (!auth?.expiresAt) return;

    const scheduleRefresh = () => {
      const msUntilRefresh = auth.expiresAt - Date.now() - REFRESH_BUFFER_MS;
      if (msUntilRefresh <= 0) {
        refreshAccessToken().catch(() => handleUnauthorized());
        return undefined;
      }
      const timer = window.setTimeout(() => {
        refreshAccessToken().catch(() => handleUnauthorized());
      }, msUntilRefresh);
      return timer;
    };

    const timer = scheduleRefresh();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [auth?.expiresAt, refreshAccessToken, handleUnauthorized]);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: getApiUrl(),
        getAccessToken: () => authRef.current?.tokens.accessToken ?? null,
        onUnauthorized: handleUnauthorized,
        refreshSession: () => refreshAccessToken(),
        getTenantId: getTenantIdFromCookie,
      }),
    [handleUnauthorized, refreshAccessToken],
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
      persist(authDataFromSession(body.data.user, body.data.tokens));
    },
    [persist],
  );

  const loginWithOtp = useCallback(
    async (phone: string, otp: string) => {
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatPhone(phone), otp: otp.trim() }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(parseAuthError(body, 'Login failed'));
      persist(authDataFromSession(body.data.user, body.data.tokens));
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
      referralCode?: string;
    }) => {
      const res = await fetch(`${getApiUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? 'Registration failed');
      persist(authDataFromSession(body.data.user, body.data.tokens));
    },
    [persist],
  );

  const requestOtp = useCallback(async (phone: string) => {
    const res = await fetch(`${getApiUrl()}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatPhone(phone) }),
    });
    const body = await res.json();
    if (!body.success) throw new Error(parseAuthError(body, 'Failed to send OTP'));
    return {
      phone: (body.data.phone as string | undefined) ?? formatPhone(phone),
    };
  }, []);

  const signupWithOtp = loginWithOtp;

  const logout = useCallback(async () => {
    const token = authRef.current?.tokens.accessToken;
    if (token) {
      await fetch(`${getApiUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    persist(null);
  }, [persist]);

  const value: AuthContextValue = {
    user: auth?.user ?? null,
    tokens: auth?.tokens ?? null,
    isAuthenticated: !!auth,
    isLoading,
    login,
    loginWithOtp,
    signupWithOtp,
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
