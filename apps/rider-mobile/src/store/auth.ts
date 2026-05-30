import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@lunara/hooks';
import type { AuthTokens, User } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { getApiV1BaseUrl } from '../api-config';

const STORAGE_KEY = 'lunara_rider_auth';

const api = createApiClient({
  baseUrl: getApiV1BaseUrl(),
  getAccessToken: () => useAuthStore.getState().tokens?.accessToken ?? null,
  onUnauthorized: () => {
    void useAuthStore.getState().logout();
  },
});

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  tokens: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { user, tokens } = JSON.parse(stored) as {
          user: User;
          tokens: AuthTokens;
        };
        set({ user, tokens, isLoading: false });
        return;
      }
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    set({ isLoading: false });
  },

  login: async (email, password) => {
    let res: Response;
    const baseUrl = getApiV1BaseUrl();
    try {
      res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(
        `Cannot reach API at ${baseUrl}. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.`,
      );
    }
    const body = await res.json();
    if (!body.success) throw new Error(body.error?.message ?? 'Login failed');
    if (body.data.user.role !== UserRole.RIDER) {
      throw new Error('This account is not a rider. Use rider@lunara.dev');
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(body.data));
    set({ user: body.data.user, tokens: body.data.tokens });
  },

  logout: async () => {
    const { tokens } = get();
    if (tokens?.accessToken) {
      await fetch(`${getApiV1BaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => {});
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ user: null, tokens: null });
  },

  apiFetch: async <T>(path: string, init?: RequestInit) => {
    const { tokens } = get();
    let res: Response;
    try {
      res = await fetch(`${getApiV1BaseUrl()}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new Error(
        `Cannot reach API at ${getApiV1BaseUrl()}. Start the API: npm run dev --workspace=@lunara/api`,
      );
    }
    const body = await res.json();
    if (res.status === 401) {
      await get().logout();
      throw new Error('Session expired. Please sign in again.');
    }
    if (!body.success) throw new Error(body.error?.message ?? 'Request failed');
    return body.data as T;
  },
}));

/** Typed fetch using the shared API client (GET/POST helpers). */
export { api as riderApi };
