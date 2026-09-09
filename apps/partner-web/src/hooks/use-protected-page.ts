'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserRole, type PortalRole } from '@lunara/types';
import { getPartnerToken, getPortalUser } from '../lib/partner-api';
import { withPartnerSlug } from '../lib/partner-path';

export interface ProtectedPageOptions {
  roles?: PortalRole[];
  /** Where to send users who lack the required role (an app-internal absolute path). */
  redirectTo?: string;
}

function defaultRedirectForRole(role?: PortalRole) {
  if (role === UserRole.STAFF) return '/orders';
  return '/';
}

/**
 * Client-side route guard for partner portal pages.
 * Returns `ready` when the user may view the page.
 */
export function useProtectedPage(options: ProtectedPageOptions = {}) {
  const { roles, redirectTo } = options;
  const { partnerSlug } = useParams<{ partnerSlug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getPartnerToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (roles?.length) {
      const user = getPortalUser();
      if (!user || !roles.includes(user.role)) {
        router.replace(withPartnerSlug(partnerSlug, redirectTo ?? defaultRedirectForRole(user?.role)));
        return;
      }
    }

    setReady(true);
  }, [roles, redirectTo, partnerSlug, pathname, router]);

  return { ready, user: getPortalUser() };
}

export function useRequirePartner() {
  return useProtectedPage({ roles: [UserRole.PARTNER, UserRole.ADMIN], redirectTo: '/orders' });
}
