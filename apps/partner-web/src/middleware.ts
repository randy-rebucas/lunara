import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveApiV1BaseUrl } from '@lunara/hooks';

const TENANT_COOKIE = 'lunara_partner_id';
const PARTNER_HEADER = 'x-lunara-partner-id';

interface BrandingResponse {
  success: boolean;
  data?: {
    isDefault: boolean;
    partnerId: string | null;
  };
}

/**
 * Resolves the requesting Host to a partner brand via the public branding endpoint (same as
 * customer-web's middleware). This is cosmetic only: partner-web is an authenticated portal, so
 * the JWT (via the API's TenantGuard) remains the sole source of truth for data access — a staff
 * or partner user can still log into any domain with valid credentials. This just lets the
 * pre-login /login screen show the right partner's branding before a token exists.
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (!host) return NextResponse.next();

  let branding: BrandingResponse['data'] | undefined;
  try {
    const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
    const res = await fetch(`${apiBase}/public/branding?domain=${encodeURIComponent(host)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const body = (await res.json()) as BrandingResponse;
      branding = body.data;
    }
  } catch {
    return NextResponse.next();
  }

  if (!branding || branding.isDefault || !branding.partnerId) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PARTNER_HEADER, branding.partnerId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(TENANT_COOKIE, branding.partnerId, {
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
