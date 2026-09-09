'use client';

import { PortalLoginScreen } from '../../components/portal-login-screen';

/** Tenant-agnostic sign-in: no /{partnerSlug} context yet (a fresh session, a 401 redirect, a
 * logout, or a brand-new visitor from /signup — none of them know a slug at this point). Once
 * signed in, the token resolves the user's own portal (see app/page.tsx's root redirector). */
export default function PortalLoginPage() {
  return <PortalLoginScreen defaultNext="/" />;
}
