import { resolveApiV1BaseUrl } from '@lunara/utils';
import { parseApiError } from './api-error';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_portal_token';
const USER_KEY = 'lunara_portal_user';

export function getPartnerToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setPartnerToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearPartnerToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getPortalUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email?: string; role: string };
  } catch {
    return null;
  }
}

export function isPartnerRole() {
  const u = getPortalUser();
  return u?.role === 'partner' || u?.role === 'admin';
}

export async function staffLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(parseApiError(body, 'Login failed'));
  const role = body.data.user.role as string;
  if (role !== 'staff' && role !== 'partner' && role !== 'admin') {
    throw new Error('Staff or partner account required');
  }
  setPartnerToken(body.data.tokens.accessToken);
  const user = body.data.user as { email?: string; role: string };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function staffLogout() {
  const token = getPartnerToken();
  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearPartnerToken();
}

export async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPartnerToken();
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
  const body = await res.json();
  if (res.status === 401) {
    clearPartnerToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(parseApiError(body));
  return body.data as T;
}
