import { assertApiUrlConfigured, resolveApiV1BaseUrl } from '@lunara/utils';
import type {
  AiAgentPersona,
  AiChatMessage,
  AiConversationSummary,
  AiPromptLibraryGroup,
  AuthTokens,
  User,
} from '@lunara/types';

assertApiUrlConfigured(process.env.NEXT_PUBLIC_API_URL, 'ai-agents');
const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_ai_agents_auth';
const REMEMBER_KEY = 'lunara_ai_agents_remember';
const REFRESH_BUFFER_MS = 60_000;

interface AiAgentsAuthData {
  user: User;
  tokens: AuthTokens;
  expiresAt: number;
}

let authData: AiAgentsAuthData | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<void> | null = null;

function hydrateStoredAuth(raw: unknown): AiAgentsAuthData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AiAgentsAuthData>;
  if (!data.user || !data.tokens?.accessToken || !data.tokens.refreshToken) return null;
  const expiresAt =
    typeof data.expiresAt === 'number'
      ? data.expiresAt
      : Date.now() + (data.tokens.expiresIn ?? 3600) * 1000;
  return { user: data.user, tokens: data.tokens, expiresAt };
}

function authDataFromSession(user: User, tokens: AuthTokens): AiAgentsAuthData {
  return { user, tokens, expiresAt: Date.now() + tokens.expiresIn * 1000 };
}

/** "Remember this device" controls whether the session survives closing the browser
 * (localStorage) or is cleared with it (sessionStorage) — a real difference, not cosmetic. */
function persistAuth(data: AiAgentsAuthData | null, remember = true) {
  authData = data;
  if (typeof window === 'undefined') return;
  if (data) {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    const activeStore = remember ? localStorage : sessionStorage;
    const inactiveStore = remember ? sessionStorage : localStorage;
    activeStore.setItem(STORAGE_KEY, JSON.stringify(data));
    inactiveStore.removeItem(STORAGE_KEY);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

function loadStoredAuth() {
  if (typeof window === 'undefined') return null;
  const remember = localStorage.getItem(REMEMBER_KEY) !== '0';
  const store = remember ? localStorage : sessionStorage;
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return hydrateStoredAuth(JSON.parse(raw));
  } catch {
    store.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getCurrentUser(): User | null {
  if (authData?.user) return authData.user;
  if (typeof window === 'undefined') return null;
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    return stored.user;
  }
  return null;
}

export function getAuthToken() {
  if (authData?.tokens.accessToken) return authData.tokens.accessToken;
  if (typeof window === 'undefined') return '';
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    return stored.tokens.accessToken;
  }
  return '';
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
  if (!current?.tokens.refreshToken) throw new Error('No refresh token');

  const task = (async () => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.tokens.refreshToken }),
    });

    let body: { success?: boolean; data?: { user?: User; tokens: AuthTokens }; error?: { message?: string } };
    try {
      body = await res.json();
    } catch {
      throw new Error('Session expired');
    }

    if (!body.success || !body.data?.tokens) {
      throw new Error(body.error?.message ?? 'Session expired');
    }

    const remember = typeof window === 'undefined' || localStorage.getItem(REMEMBER_KEY) !== '0';
    persistAuth(authDataFromSession(body.data.user ?? current.user, body.data.tokens), remember);
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

export function initAuthSession() {
  const stored = loadStoredAuth();
  if (stored) {
    authData = stored;
    scheduleTokenRefresh();
  }
  return !!stored;
}

export function clearSession() {
  persistAuth(null);
  clearRefreshTimer();
}

export async function login(email: string, password: string, remember = true) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  let body: { success?: boolean; data?: { user: User; tokens: AuthTokens }; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new Error('Invalid response from API');
  }

  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? 'Login failed');
  }

  const allowedRoles = ['staff', 'admin', 'customer'];
  if (!allowedRoles.includes(body.data.user.role)) {
    throw new Error('This account type cannot access the AI team');
  }

  persistAuth(authDataFromSession(body.data.user, body.data.tokens), remember);
  scheduleTokenRefresh();
  return body.data.user;
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  let body: { success?: boolean; data?: { user: User; tokens: AuthTokens }; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new Error('Invalid response from API');
  }

  if (!body.success || !body.data) {
    throw new Error(body.error?.message ?? 'Registration failed');
  }

  persistAuth(authDataFromSession(body.data.user, body.data.tokens), true);
  scheduleTokenRefresh();
  return body.data.user;
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  let body: { success?: boolean; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new Error('Invalid response from API');
  }

  if (!body.success) {
    throw new Error(body.error?.message ?? 'Request failed');
  }
}

export async function logout() {
  const token = getAuthToken();
  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearSession();
}

async function apiFetchResponse(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach API at ${API_URL}. Start the API: npm run dev --workspace=@lunara/api`);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await apiFetchResponse(path, init);

  if (res.status === 401 && authData?.tokens.refreshToken) {
    try {
      await refreshAccessToken();
      res = await apiFetchResponse(path, init);
    } catch {
      handleUnauthorized();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  let body: { success?: boolean; data?: T; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(res.ok ? 'Invalid response from API' : `API error (${res.status}).`);
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

export function listAgents() {
  return apiFetch<AiAgentPersona[]>('/ai-agents');
}

export function getPromptLibrary(agentId: string) {
  return apiFetch<AiPromptLibraryGroup[]>(`/ai-agents/${agentId}/prompt-library`);
}

export function listConversations(agentId: string) {
  return apiFetch<AiConversationSummary[]>(`/ai-agents/${agentId}/conversations`);
}

export function getMessages(conversationId: string) {
  return apiFetch<AiChatMessage[]>(`/ai-agents/conversations/${conversationId}/messages`);
}

export function sendMessage(agentId: string, message: string, conversationId?: string) {
  return apiFetch<{ conversationId: string; message: AiChatMessage }>(`/ai-agents/${agentId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, conversationId }),
  });
}

// Logged-out access — no auth token attached, no conversation history. Only Emma responds here,
// and only with the general "how it works" prompt set (enforced server-side).
async function guestApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body: { success?: boolean; data?: T; error?: { message?: string } };
  try {
    body = await res.json();
  } catch {
    throw new Error(res.ok ? 'Invalid response from API' : `API error (${res.status}).`);
  }
  if (!body.success) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as T;
}

export function getGuestPromptLibrary(agentId: string) {
  return guestApiFetch<AiPromptLibraryGroup[]>(`/ai-agents/guest/${agentId}/prompt-library`);
}

export function sendGuestMessage(agentId: string, message: string) {
  return guestApiFetch<{ message: AiChatMessage }>(`/ai-agents/guest/${agentId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
