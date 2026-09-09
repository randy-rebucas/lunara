import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Partner identity is now resolved from the /{partnerSlug} route segment (see
 * app/[partnerSlug]/layout.tsx) rather than the request Host header. This middleware is a no-op
 * placeholder kept for future cross-cutting concerns (auth redirects, etc.).
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
