import { resolveApiV1BaseUrl } from '@lunara/utils';
import type { AuthTokens, User } from '@lunara/types';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_admin_auth';
const SESSION_COOKIE = 'lunara_admin_session';
const REFRESH_BUFFER_MS = 60_000;

interface AdminAuthData {
  user: User;
  tokens: AuthTokens;
  expiresAt: number;
}

let authData: AdminAuthData | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<void> | null = null;

function hydrateStoredAuth(raw: unknown): AdminAuthData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AdminAuthData>;
  if (!data.user || !data.tokens?.accessToken || !data.tokens.refreshToken) return null;
  const expiresAt =
    typeof data.expiresAt === 'number'
      ? data.expiresAt
      : Date.now() + (data.tokens.expiresIn ?? 3600) * 1000;
  return { user: data.user, tokens: data.tokens, expiresAt };
}

function authDataFromSession(user: User, tokens: AuthTokens): AdminAuthData {
  return {
    user,
    tokens,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
}

function setSessionCookie(maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function persistAuth(data: AdminAuthData | null) {
  authData = data;
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSessionCookie(data.tokens.expiresIn);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    clearSessionCookie();
  }
}

function loadStoredAuth() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return hydrateStoredAuth(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getAdminToken() {
  if (authData?.tokens.accessToken) return authData.tokens.accessToken;
  if (typeof window === 'undefined') return '';
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    return stored.tokens.accessToken;
  }
  return '';
}

export function getAdminUser() {
  if (authData?.user) return authData.user;
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    return stored.user;
  }
  return null;
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function handleUnauthorized() {
  persistAuth(null);
  clearRefreshTimer();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

async function refreshAccessToken() {
  if (refreshInFlight) {
    await refreshInFlight;
    return;
  }

  const current = authData ?? loadStoredAuth();
  if (!current?.tokens.refreshToken) {
    throw new Error('No refresh token');
  }

  const task = (async () => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
    });

    let body: {
      success?: boolean;
      data?: { user?: User; tokens: AuthTokens };
      error?: { message?: string };
    };
    try {
      body = await res.json();
    } catch {
      throw new Error('Session expired');
    }

    if (!body.success || !body.data?.tokens) {
      throw new Error(body.error?.message ?? 'Session expired');
    }

    persistAuth(authDataFromSession(body.data.user ?? current.user, body.data.tokens));
    scheduleTokenRefresh();
  })();

  refreshInFlight = task;
  try {
    await task;
  } finally {
    refreshInFlight = null;
  }
}

function scheduleTokenRefresh() {
  clearRefreshTimer();
  if (!authData?.expiresAt || typeof window === 'undefined') return;

  const msUntilRefresh = authData.expiresAt - Date.now() - REFRESH_BUFFER_MS;
  if (msUntilRefresh <= 0) {
    refreshAccessToken().catch(() => handleUnauthorized());
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch(() => handleUnauthorized());
  }, msUntilRefresh);
}

export function initAdminAuthSession() {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('lunara_admin_token')) {
      localStorage.removeItem('lunara_admin_token');
      localStorage.removeItem('lunara_admin_user');
    }
  }
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    scheduleTokenRefresh();
  }
  return !!stored;
}

export function clearAdminSession() {
  persistAuth(null);
  clearRefreshTimer();
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  let body: {
    success?: boolean;
    data?: { user: User; tokens: AuthTokens };
    error?: { message?: string };
  };
  try {
    body = await res.json();
  } catch {
    throw new Error('Invalid response from API');
  }

  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? 'Login failed');
  }

  if (body.data.user.role !== 'admin') {
    throw new Error('Admin account required');
  }

  persistAuth(authDataFromSession(body.data.user, body.data.tokens));
  scheduleTokenRefresh();
  return body.data.user;
}

export async function adminLogout() {
  const token = getAdminToken();
  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearAdminSession();
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_URL}. Start the API: npm run dev --workspace=@lunara/api`,
    );
  }

  let body: { success?: boolean; data?: T; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(
      res.ok
        ? 'Invalid response from API'
        : `API error (${res.status}). Check that NEXT_PUBLIC_API_URL includes /api/v1.`,
    );
  }

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!body.success) {
    throw new Error(body.error?.message ?? 'Request failed');
  }

  return body.data as T;
}

/** Fetch a protected upload URL and return a blob object URL for use in img src. */
export async function fetchAuthenticatedMediaUrl(publicPath: string): Promise<string> {
  const token = getAdminToken();
  const origin = API_URL.replace(/\/api\/v1$/, '');
  const url = publicPath.startsWith('http') ? publicPath : `${origin}${publicPath}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    throw new Error('Failed to load media');
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
