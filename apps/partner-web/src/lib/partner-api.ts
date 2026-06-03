import type { PortalRole, PortalUser } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { resolveApiOrigin, resolveApiV1BaseUrl } from '@lunara/utils';
import { parseApiError } from './api-error';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_portal_token';
const USER_KEY = 'lunara_portal_user';

export type { PortalRole, PortalUser };

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

export function getPortalUser(): PortalUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalUser;
  } catch {
    return null;
  }
}

export function isPartnerRole(user = getPortalUser()) {
  return user?.role === UserRole.PARTNER || user?.role === UserRole.ADMIN;
}

export function isStaffRole(user = getPortalUser()) {
  return user?.role === UserRole.STAFF;
}

export function hasPortalRole(roles: PortalRole[], user = getPortalUser()) {
  return !!user && roles.includes(user.role);
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
  const user: PortalUser = {
    email: body.data.user.email,
    role: body.data.user.role,
    branchId: body.data.user.branchId,
  };
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

export async function uploadProcessingPhoto(orderId: string, file: File): Promise<string> {
  const token = getPartnerToken();
  const formData = new FormData();
  formData.append('photo', file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/partner/orders/${orderId}/processing/photo-upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach API to upload photo.');
  }

  const body = await res.json();
  if (res.status === 401) {
    clearPartnerToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(parseApiError(body, 'Photo upload failed'));
  return body.data.photoUrl as string;
}

/** Build absolute URL for uploaded task photos. */
export function resolveMediaUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const origin = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Fetch a JWT-protected upload and return a blob object URL for previews. */
export async function fetchAuthenticatedMediaUrl(publicPath: string): Promise<string> {
  const token = getPartnerToken();
  const url = resolveMediaUrl(publicPath);

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    clearPartnerToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw new Error('Failed to load media');
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
