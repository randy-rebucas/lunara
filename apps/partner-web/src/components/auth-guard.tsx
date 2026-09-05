'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthLoading } from './auth-loading';
import { getPartnerToken } from '../lib/partner-api';

const PUBLIC_PATHS = new Set(['/login', '/offline', '/signup', '/verify-email']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(PUBLIC_PATHS.has(pathname));

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) {
      setReady(true);
      return;
    }
    const token = getPartnerToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return <AuthLoading message="Checking session…" />;
  return <>{children}</>;
}
