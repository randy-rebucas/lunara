import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, User } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { formatPhone } from '@lunara/utils';
import { authRequest } from '../lib/api-client';

// Re-exported for compatibility — `getPartnerId` is a generic client utility (not auth-specific)
// but many screens already import it alongside `useAuthStore` from this module.
export { getPartnerId } from '../lib/api-client';

// User profile (non-sensitive) stays in AsyncStorage; the access/refresh token pair is the
// sensitive part and lives in SecureStore (Keychain/Keystore-backed) instead of plain storage.
const USER_STORAGE_KEY = 'lunara_auth_user';
const TOKENS_STORAGE_KEY = 'lunara_auth_tokens';

async function persistSession(user: User, tokens: AuthTokens): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)),
    SecureStore.setItemAsync(TOKENS_STORAGE_KEY, JSON.stringify(tokens)),
  ]);
}

async function clearSession(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(USER_STORAGE_KEY),
    SecureStore.deleteItemAsync(TOKENS_STORAGE_KEY),
  ]);
}

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

let refreshInFlight: Promise<string | null> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  tokens: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const [storedUser, storedTokens] = await Promise.all([
        AsyncStorage.getItem(USER_STORAGE_KEY),
        SecureStore.getItemAsync(TOKENS_STORAGE_KEY),
      ]);
      if (storedUser && storedTokens) {
        const user = JSON.parse(storedUser) as User;
        const tokens = JSON.parse(storedTokens) as AuthTokens;
        set({ user, tokens, isLoading: false });
        return;
      }
    } catch {
      await clearSession();
    }
    set({ isLoading: false });
  },

  login: async (email, password) => get().loginWithEmail(email, password),

  loginWithEmail: async (email, password) => {
    const data = await authRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      kind: 'json',
      init: { method: 'POST', body: JSON.stringify({ email, password }) },
    });
    if (data.user.role !== UserRole.CUSTOMER) {
      throw new Error('This account is not a customer account.');
    }
    await persistSession(data.user, data.tokens);
    set({ user: data.user, tokens: data.tokens });
  },

  loginWithOtp: async (phone, otp) => {
    const data = await authRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      kind: 'json',
      init: { method: 'POST', body: JSON.stringify({ phone: formatPhone(phone), otp: otp.trim() }) },
    });
    if (data.user.role !== UserRole.CUSTOMER) {
      throw new Error('This account is not a customer account.');
    }
    await persistSession(data.user, data.tokens);
    set({ user: data.user, tokens: data.tokens });
  },

  signupWithOtp: async (phone, otp) => get().loginWithOtp(phone, otp),

  requestOtp: async (phone) => {
    const data = await authRequest<{ phone: string }>('/auth/otp/request', {
      kind: 'json',
      init: { method: 'POST', body: JSON.stringify({ phone: formatPhone(phone) }) },
    });
    return {
      phone: data.phone ?? formatPhone(phone),
    };
  },

  logout: async () => {
    const { tokens } = get();
    if (tokens?.accessToken) {
      await authRequest(
        '/auth/logout',
        { kind: 'json', init: { method: 'POST', headers: { Authorization: `Bearer ${tokens.accessToken}` } } },
      ).catch(() => {});
    }
    await clearSession();
    set({ user: null, tokens: null });
  },

  apiFetch: async <T>(path: string, init?: RequestInit) => {
    const { tokens } = get();
    if (!tokens?.accessToken) {
      throw new Error('Please sign in to continue.');
    }
    return authRequest<T>(
      path,
      { kind: 'json', init },
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
    return authRequest<T>(
      path,
      { kind: 'form', formData },
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
        kind: 'json',
        init: { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }) },
      });
      const nextUser = data.user ?? user;
      if (!nextUser) return null;
      const next = { user: nextUser, tokens: data.tokens };
      await persistSession(nextUser, data.tokens);
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
