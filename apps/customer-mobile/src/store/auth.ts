import { create } from 'zustand';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens, User } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { formatPhone } from '@lunara/utils';
import { getApiV1BaseUrl } from '../api-config';
import { parseApiError } from '../lib/api-error';
import { apiUnreachableMessage } from '../lib/network-error';

/** Baked in at build time per partner-brands/<slug>/manifest.json — null for the default Lunara app. */
function getPartnerId(): string | null {
  return (Constants.expoConfig?.extra?.partnerId as string | null) ?? null;
}

const STORAGE_KEY = 'lunara_auth';

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  signupWithOtp: (phone: string, otp: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ phone: string }>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  apiUpload: <T>(path: string, formData: FormData) => Promise<T>;
}

/** On a 401 with a refresh function available, try refreshing once and retrying the original
 * request before giving up — mirrors customer-web's AuthProvider, which transparently refreshes
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
  const partnerId = getPartnerId();
  const doFetch = async (accessToken?: string | null) => {
    try {
      return await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(partnerId ? { 'x-lunara-partner-id': partnerId } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new Error(apiUnreachableMessage(baseUrl));
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

async function authUpload<T>(
  path: string,
  formData: FormData,
  token?: string | null,
  onUnauthorized?: () => void,
  refreshAndGetToken?: () => Promise<string | null>,
): Promise<T> {
  const baseUrl = getApiV1BaseUrl();
  const partnerId = getPartnerId();
  const doFetch = async (accessToken?: string | null) => {
    try {
      return await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(partnerId ? { 'x-lunara-partner-id': partnerId } : {}),
        },
        body: formData,
      });
    } catch {
      throw new Error(apiUnreachableMessage(baseUrl));
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

let refreshInFlight: Promise<string | null> | null = null;

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
      body: JSON.stringify({ phone: formatPhone(phone), otp: otp.trim() }),
    });
    if (data.user.role !== UserRole.CUSTOMER) {
      throw new Error('This account is not a customer account.');
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    set({ user: data.user, tokens: data.tokens });
  },

  signupWithOtp: async (phone, otp) => get().loginWithOtp(phone, otp),

  requestOtp: async (phone) => {
    const data = await authRequest<{ phone: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone: formatPhone(phone) }),
    });
    return {
      phone: data.phone ?? formatPhone(phone),
    };
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

  apiUpload: async <T>(path: string, formData: FormData) => {
    const { tokens } = get();
    if (!tokens?.accessToken) {
      throw new Error('Please sign in to continue.');
    }
    return authUpload<T>(
      path,
      formData,
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
