import type {
  PartnerBranchRider,
  PartnerOwnedRider,
  PartnerOwnProfile,
  PortalRole,
  PortalUser,
} from '@lunara/types';
import { UserRole } from '@lunara/types';
import { assertApiUrlConfigured, resolveApiOrigin, resolveApiV1BaseUrl } from '@lunara/utils';
import { parseApiError } from './api-error';

assertApiUrlConfigured(process.env.NEXT_PUBLIC_API_URL, 'partner-web');
const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
const STORAGE_KEY = 'lunara_portal_token';
const USER_KEY = 'lunara_portal_user';

export type { PortalRole, PortalUser };

/** Base API URL for callers that need to build a raw `fetch` (e.g. a binary PDF download that
 * can't go through partnerFetch's JSON-only response handling). */
export function getApiBaseUrl() {
  return API_URL;
}

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
    credentials: 'include',
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
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    // Bearer token as fallback for environments where cookie is absent
    headers: { Authorization: `Bearer ${getPartnerToken()}` },
  }).catch(() => {});
  clearPartnerToken();
}

export async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Cookie (HttpOnly) is the primary auth mechanism; token in localStorage is kept for socket auth only.
  const token = getPartnerToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        // Bearer header as fallback (e.g. dev without cookie, or direct API calls)
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

export async function uploadShopLogo(file: File): Promise<{ id: string; logoUrl?: string }> {
  const token = getPartnerToken();
  const formData = new FormData();
  formData.append('logo', file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/partner/settings/logo`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach API to upload logo.');
  }

  const body = await res.json();
  if (res.status === 401) {
    clearPartnerToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(parseApiError(body, 'Logo upload failed'));
  return body.data.branch;
}

export async function removeShopLogo(): Promise<{ id: string; logoUrl?: string }> {
  return partnerFetch('/partner/settings/logo', { method: 'DELETE' }).then(
    (data) => (data as { branch: { id: string; logoUrl?: string } }).branch,
  );
}

export async function getOwnProfile(): Promise<PartnerOwnProfile> {
  return partnerFetch<PartnerOwnProfile>('/partner/profile');
}

/** Tokenizes a card directly against PayMongo's API from the browser using the publishable
 * key — raw card details never touch our own server, only the resulting Payment Method id
 * does (sent on to attachPaymentMethod below). */
export async function createPaymongoCardPaymentMethod(card: {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}): Promise<string> {
  const publicKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY;
  if (!publicKey) throw new Error('Card payments are not configured for this environment');

  const res = await fetch('https://api.paymongo.com/v1/payment_methods', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${publicKey}:`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: 'card',
          details: {
            card_number: card.cardNumber.replace(/\s+/g, ''),
            exp_month: card.expMonth,
            exp_year: card.expYear,
            cvc: card.cvc,
          },
        },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.data?.id) {
    const detail = json.errors?.map((e: { detail: string }) => e.detail).join('; ') || 'Card was rejected';
    throw new Error(detail);
  }
  return json.data.id as string;
}

export interface PartnerPaymentMethodInfo {
  onFile: boolean;
  brand?: string;
  last4?: string;
}

export async function getPaymentMethod(): Promise<PartnerPaymentMethodInfo> {
  return partnerFetch<PartnerPaymentMethodInfo>('/partner/billing/payment-method');
}

export async function attachPaymentMethod(paymongoPaymentMethodId: string): Promise<void> {
  await partnerFetch('/partner/billing/payment-method', {
    method: 'POST',
    body: JSON.stringify({ paymongoPaymentMethodId }),
  });
}

export async function removePaymentMethod(): Promise<void> {
  await partnerFetch('/partner/billing/payment-method', { method: 'DELETE' });
}

export async function redeemPromoCode(code: string): Promise<void> {
  await partnerFetch('/partner/billing/promotion', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function updateOwnProfile(displayName: string): Promise<PartnerOwnProfile> {
  return partnerFetch<PartnerOwnProfile>('/partner/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

async function uploadAvatar(path: string, file: File): Promise<PartnerOwnProfile> {
  const token = getPartnerToken();
  const formData = new FormData();
  formData.append('avatar', file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach API to upload avatar.');
  }

  const body = await res.json();
  if (res.status === 401) {
    clearPartnerToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please sign in again.');
  }
  if (!body.success) throw new Error(parseApiError(body, 'Avatar upload failed'));
  return body.data as PartnerOwnProfile;
}

export async function uploadOwnAvatar(file: File): Promise<PartnerOwnProfile> {
  return uploadAvatar('/partner/profile/avatar', file);
}

export async function removeOwnAvatar(): Promise<PartnerOwnProfile> {
  return partnerFetch<PartnerOwnProfile>('/partner/profile/avatar', { method: 'DELETE' });
}

export async function updateStaffProfile(
  staffId: string,
  displayName?: string,
  canManageSettings?: boolean,
  phone?: string,
  email?: string,
): Promise<PartnerOwnProfile> {
  return partnerFetch<PartnerOwnProfile>(`/partner/staff/${staffId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(displayName !== undefined ? { displayName } : {}),
      ...(canManageSettings !== undefined ? { canManageSettings } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
    }),
  });
}

export async function resetStaffPassword(staffId: string, password: string): Promise<void> {
  await partnerFetch(`/partner/staff/${staffId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function removeStaff(staffId: string): Promise<void> {
  await partnerFetch(`/partner/staff/${staffId}`, { method: 'DELETE' });
}

export async function listAssignedRiders(): Promise<PartnerBranchRider[]> {
  return partnerFetch<PartnerBranchRider[]>('/partner/riders');
}

export async function listOwnedRiders(): Promise<PartnerOwnedRider[]> {
  return partnerFetch<PartnerOwnedRider[]>('/partner/riders/owned');
}

export interface CreateOwnedRiderInput {
  email: string;
  phone?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  vehicleType?: string;
}

export async function createOwnedRider(input: CreateOwnedRiderInput): Promise<PartnerOwnedRider> {
  return partnerFetch<PartnerOwnedRider>('/partner/riders/owned', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateOwnedRiderInput {
  firstName?: string;
  lastName?: string;
  vehicleType?: string;
  plateNumber?: string;
  orCrNumber?: string;
  employmentType?: 'employee' | 'independent_contractor';
  fixedWageAmount?: number;
  wageFrequency?: 'daily' | 'weekly' | 'monthly';
}

export async function updateOwnedRider(
  riderUserId: string,
  input: UpdateOwnedRiderInput,
): Promise<PartnerOwnedRider> {
  return partnerFetch<PartnerOwnedRider>(`/partner/riders/owned/${riderUserId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function removeOwnedRider(riderUserId: string): Promise<void> {
  await partnerFetch(`/partner/riders/owned/${riderUserId}`, { method: 'DELETE' });
}

export async function uploadStaffAvatar(staffId: string, file: File): Promise<PartnerOwnProfile> {
  return uploadAvatar(`/partner/staff/${staffId}/profile/avatar`, file);
}

export async function uploadProcessingPhoto(orderId: string, file: File): Promise<string> {
  const token = getPartnerToken();
  const formData = new FormData();
  formData.append('photo', file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/partner/orders/${orderId}/processing/photo-upload`, {
      method: 'POST',
      credentials: 'include',
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
    credentials: 'include',
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
