import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens, User } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { getApiV1BaseUrl } from '../api-config';
import { parseApiError } from '../lib/api-error';

const STORAGE_KEY = 'lunara_partner_auth';

/** Roles allowed to sign in to this app — shop staff, the partner owner account, or admin. */
const ALLOWED_ROLES: string[] = [UserRole.STAFF, UserRole.PARTNER, UserRole.ADMIN];

/** On a 401 with a refresh function available, try refreshing once and retrying the original
 * request before giving up — mirrors rider-mobile/customer-mobile, which transparently refresh
 * instead of forcing a re-login every time the (7-day) access token expires despite a still-valid
 * 30-day refresh token sitting unused. */
async function authRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
  onUnauthorized?: () => void,
  refreshAndGetToken?: () => Promise<string | null>,
): Promise<T> {
  const baseUrl = getApiV1BaseUrl();
  const doFetch = async (accessToken?: string | null) => {
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new Error(
        `Cannot reach API at ${baseUrl}. Start the API (npm run dev --workspace=@lunara/api) and use the same Wi‑Fi as your phone.`,
      );
    }
  };

  let res = await doFetch(token);
  if (res.status === 401 && token && refreshAndGetToken) {
    const refreshed = await refreshAndGetToken().catch(() => null);
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }
  const body = await res.json();
  if (res.status === 401 && token) {
    onUnauthorized?.();
    throw new Error('Session expired. Please sign in again.');
  }
  if (!res.ok || body.success === false) {
    throw new Error(parseApiError(body));
  }
  return body.data as T;
}

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

let refreshInFlight: Promise<string | null> | null = null;

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
    const data = await authRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!ALLOWED_ROLES.includes(data.user.role)) {
      throw new Error('This account is not a partner staff account.');
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    set({ user: data.user, tokens: data.tokens });
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
    return authRequest<T>(
      path,
      init,
      tokens.accessToken,
      () => {
        void get().logout();
      },
      () => refreshAccessToken(get, set),
    );
  },
}));

/** Exchanges the stored refresh token for a new session, deduping concurrent callers (e.g. several
 * screens hitting a 401 at once) behind a single in-flight request. Returns the new access token,
 * or null if the refresh itself failed (caller falls through to the normal logout path). */
async function refreshAccessToken(
  get: () => AuthStore,
  set: (partial: Partial<AuthStore>) => void,
): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const { tokens, user } = get();
  if (!tokens?.refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const data = await authRequest<{ user?: User; tokens: AuthTokens }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      const nextUser = data.user ?? user;
      if (!nextUser) return null;
      const next = { user: nextUser, tokens: data.tokens };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      set(next);
      return data.tokens.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
