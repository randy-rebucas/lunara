import { resolveApiV1BaseUrl } from '@lunara/utils';
import type { AppNavStyle, AppScreen, BrandTheme, PartnerAppConfig } from '@lunara/types';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

async function unwrap<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Failed to ${action}`);
  }
  const body = await res.json();
  return body.data as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getDraft(
  partnerId: string,
  slug: string,
  token: string,
): Promise<PartnerAppConfig> {
  const res = await fetch(
    `${API_URL}/admin/app-configs/${encodeURIComponent(partnerId)}/draft?slug=${encodeURIComponent(slug)}`,
    { headers: authHeaders(token) },
  );
  return unwrap(res, 'load draft');
}

export async function saveDraft(
  partnerId: string,
  token: string,
  draft: Pick<PartnerAppConfig, 'theme' | 'screens' | 'navStyle'>,
): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/admin/app-configs/${encodeURIComponent(partnerId)}/draft`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(draft),
  });
  return unwrap(res, 'save draft');
}

export async function publishDraft(partnerId: string, token: string): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/admin/app-configs/${encodeURIComponent(partnerId)}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return unwrap(res, 'publish');
}

export async function listVersions(partnerId: string, token: string): Promise<PartnerAppConfig[]> {
  const res = await fetch(`${API_URL}/admin/app-configs/${encodeURIComponent(partnerId)}/versions`, {
    headers: authHeaders(token),
  });
  return unwrap(res, 'load versions');
}

export async function rollbackToVersion(
  partnerId: string,
  version: number,
  token: string,
): Promise<PartnerAppConfig> {
  const res = await fetch(
    `${API_URL}/admin/app-configs/${encodeURIComponent(partnerId)}/versions/${version}/rollback`,
    { method: 'POST', headers: authHeaders(token) },
  );
  return unwrap(res, 'roll back');
}

export async function getPublicPreset(slug: string): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/public/app-configs/${encodeURIComponent(slug)}`);
  return unwrap(res, 'load preset');
}

export interface ClaimResult {
  user: { id: string; email: string; role: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  config: PartnerAppConfig;
}

/** Turns an anonymous builder session into an account — the only point the public builder
 *  asks for auth. */
export async function claimDesign(payload: {
  email: string;
  password: string;
  brandName: string;
  theme: BrandTheme;
  screens: AppScreen[];
  navStyle?: AppNavStyle;
}): Promise<ClaimResult> {
  const res = await fetch(`${API_URL}/public/app-configs/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return unwrap(res, 'save your design');
}

// Self-service (brand owner) variants — same shapes as the admin ones above, minus partnerId
// since the API derives it from the bearer token.

export async function getMyDraft(token: string): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/partner/app-configs/me/draft`, { headers: authHeaders(token) });
  return unwrap(res, 'load your draft');
}

export async function saveMyDraft(
  token: string,
  draft: Pick<PartnerAppConfig, 'theme' | 'screens' | 'navStyle'>,
): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/partner/app-configs/me/draft`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(draft),
  });
  return unwrap(res, 'save your draft');
}

export async function publishMyDraft(token: string): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/partner/app-configs/me/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return unwrap(res, 'publish');
}

export async function listMyVersions(token: string): Promise<PartnerAppConfig[]> {
  const res = await fetch(`${API_URL}/partner/app-configs/me/versions`, {
    headers: authHeaders(token),
  });
  return unwrap(res, 'load versions');
}

export async function rollbackMyVersion(version: number, token: string): Promise<PartnerAppConfig> {
  const res = await fetch(`${API_URL}/partner/app-configs/me/versions/${version}/rollback`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  return unwrap(res, 'roll back');
}
