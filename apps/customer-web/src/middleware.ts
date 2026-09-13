import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import type { PartnerBrandConfig } from '@lunara/types';
import { BRAND_CONFIG_HEADER } from './lib/brand-header';

const TENANT_COOKIE = 'lunara_partner_id';
const PARTNER_HEADER = 'x-lunara-partner-id';

interface BrandingResponse {
  success: boolean;
  data?: {
    isDefault: boolean;
    partnerId: string | null;
    brandConfig?: PartnerBrandConfig;
  };
}

/**
 * Resolves the requesting Host to a partner brand via the public branding endpoint, and threads
 * the result through to (a) downstream server components via request headers — the resolved
 * partner id, and the full brand config base64-encoded so the root layout (app/layout.tsx) can
 * reuse it instead of re-fetching /public/branding itself — and (b) the browser via a cookie the
 * api-client reads to tag booking requests with the partner's tenant id.
 * On no match (default lunara.app/localhost) or any failure, the request passes through untouched.
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
  if (branding.brandConfig) {
    requestHeaders.set(
      BRAND_CONFIG_HEADER,
      btoa(encodeURIComponent(JSON.stringify(branding.brandConfig))),
    );
  }

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
