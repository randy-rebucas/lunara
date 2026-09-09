'use client';

import { useParams } from 'next/navigation';
import { PortalLoginScreen } from '../../../components/portal-login-screen';
import { withPartnerSlug } from '../../../lib/partner-path';

/** Deep-link sign-in for a known shop, e.g. a bookmarked or shared portal URL. Public despite
 * living under /{partnerSlug} — see the exceptions in AuthGuard and PortalShell. The
 * tenant-agnostic /login (no slug known — a 401 redirect, a logout, a fresh visitor) still
 * exists separately and stays the default everywhere the slug isn't already in hand. */
export default function PartnerLoginPage() {
  const { partnerSlug } = useParams<{ partnerSlug: string }>();
  return <PortalLoginScreen defaultNext={withPartnerSlug(partnerSlug, '/')} expectedSlug={partnerSlug} />;
}
