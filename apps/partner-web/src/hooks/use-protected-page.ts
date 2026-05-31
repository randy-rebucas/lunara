'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserRole, type PortalRole } from '@lunara/types';
import { getPartnerToken, getPortalUser } from '../lib/partner-api';

export interface ProtectedPageOptions {
  roles?: PortalRole[];
  /** Where to send users who lack the required role. */
  redirectTo?: string;
  loginPath?: string;
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
  const { roles, redirectTo, loginPath = '/login' } = options;
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getPartnerToken();
    if (!token) {
      router.replace(loginPath);
      return;
    }

    if (roles?.length) {
      const user = getPortalUser();
      if (!user || !roles.includes(user.role)) {
        router.replace(redirectTo ?? defaultRedirectForRole(user?.role));
        return;
      }
    }

    setReady(true);
  }, [roles, redirectTo, loginPath, router]);

  return { ready, user: getPortalUser() };
}

export function useRequirePartner() {
  return useProtectedPage({ roles: [UserRole.PARTNER, UserRole.ADMIN], redirectTo: '/orders' });
}
