import { resolveApiV1BaseUrl } from '@lunara/utils';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_admin_token';
const USER_KEY = 'lunara_admin_user';

export function getAdminToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function setAdminToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAdminUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email?: string; role: string };
  } catch {
    return null;
  }
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.error?.message ?? 'Login failed');
  const role = body.data.user.role as string;
  if (role !== 'admin') throw new Error('Admin account required');
  setAdminToken(body.data.tokens.accessToken);
  const user = body.data.user as { email?: string; role: string };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
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
  const body = await res.json();
  if (res.status === 401) {
    clearAdminSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as T;
}
