import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens, User } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { getApiV1BaseUrl } from '../api-config';

const STORAGE_KEY = 'lunara_auth';

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

async function authRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
  onUnauthorized?: () => void,
): Promise<T> {
  const baseUrl = getApiV1BaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${baseUrl}. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.`,
    );
  }
  const body = await res.json();
  if (res.status === 401 && token) {
    onUnauthorized?.();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as T;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  tokens: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user, tokens } = JSON.parse(stored) as { user: User; tokens: AuthTokens };
        set({ user, tokens, isLoading: false });
        return;
      }
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    set({ isLoading: false });
  },

  login: async (email, password) => get().loginWithEmail(email, password),

  loginWithEmail: async (email, password) => {
    const data = await authRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.user.role !== UserRole.CUSTOMER) {
      throw new Error('This account is not a customer account.');
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    set({ user: data.user, tokens: data.tokens });
  },

  loginWithOtp: async (phone, otp) => {
    const data = await authRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
    if (data.user.role !== UserRole.CUSTOMER) {
      throw new Error('This account is not a customer account.');
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    set({ user: data.user, tokens: data.tokens });
  },

  requestOtp: async (phone) => {
    const data = await authRequest<{ devOtp?: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return data.devOtp;
  },

  logout: async () => {
    const { tokens } = get();
    if (tokens?.accessToken) {
      await authRequest('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => {});
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ user: null, tokens: null });
  },

  apiFetch: async <T>(path: string, init?: RequestInit) => {
    const { tokens } = get();
    if (!tokens?.accessToken) {
      throw new Error('Please sign in to continue.');
    }
    return authRequest<T>(path, init, tokens.accessToken, () => {
      void get().logout();
    });
  },
}));
