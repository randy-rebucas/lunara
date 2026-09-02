import { resolveApiV1BaseUrl } from '@lunara/utils';

const API_URL = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);

export async function loginBrandOwner(
  email: string,
  password: string,
): Promise<{ accessToken: string; role: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message || 'Failed to sign in');
  if (body.data.user.role !== 'brand_owner') {
    throw new Error('This account is not an app-builder account.');
  }
  return { accessToken: body.data.tokens.accessToken, role: body.data.user.role };
}
