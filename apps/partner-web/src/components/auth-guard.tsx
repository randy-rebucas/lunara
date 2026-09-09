'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthLoading } from './auth-loading';
import { getMyBranding, getPartnerToken } from '../lib/partner-api';
import { rememberPartnerSlug, stripPartnerSlug, withPartnerSlug } from '../lib/partner-path';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { partnerSlug } = useParams<{ partnerSlug: string }>();
  const router = useRouter();
  // Pages without a /{partnerSlug} segment are the top-level public routes (/, /login, /signup,
  // /verify-email, /offline) — none of them need guarding here. /{partnerSlug}/login is also
  // public — it's the deep-link sign-in page itself, so it can't require a token to view.
  const isDeepLinkLogin = Boolean(partnerSlug) && stripPartnerSlug(pathname, partnerSlug) === '/login';
  const isPublicPath = !partnerSlug || isDeepLinkLogin;
  const [ready, setReady] = useState(isPublicPath);

  useEffect(() => {
    if (isPublicPath) {
      setReady(true);
      return;
    }
    const token = getPartnerToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    setReady(false);
    // A valid session only proves *some* shop's login — it doesn't prove this one. Confirm the
    // token's own tenant matches the /{partnerSlug} in the URL before letting the page render,
    // so a session for shop A can't sit on (or be logged into) shop B's portal.
    getMyBranding()
      .then(({ slug }) => {
        if (cancelled) return;
        if (slug && slug !== partnerSlug) {
          router.replace(withPartnerSlug(slug, stripPartnerSlug(pathname, partnerSlug)));
          return;
        }
        rememberPartnerSlug(partnerSlug);
        setReady(true);
      })
      .catch(() => {
        // Branding lookup failing shouldn't block the portal — fall back to the old behavior.
        if (cancelled) return;
        rememberPartnerSlug(partnerSlug);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, partnerSlug, isPublicPath, router]);

  if (!ready) return <AuthLoading message="Checking session…" />;
  return <>{children}</>;
}
