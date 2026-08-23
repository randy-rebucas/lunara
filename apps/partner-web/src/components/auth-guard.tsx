'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthLoading } from './auth-loading';
import { getPartnerToken } from '../lib/partner-api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === '/login' || pathname === '/offline');

  useEffect(() => {
    if (pathname === '/login' || pathname === '/offline') {
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
