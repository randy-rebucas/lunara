'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthLoading } from './auth-loading';
import { getAdminToken } from '../lib/admin-api';
import { useAdminAuth } from '../lib/admin-auth-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady } = useAdminAuth();

  useEffect(() => {
    if (!isReady) return;
    if (pathname === '/login') return;
    if (!getAdminToken()) {
      router.replace('/login');
    }
  }, [pathname, router, isReady]);

  if (!isReady) return <AuthLoading message="Checking session…" />;
  if (pathname !== '/login' && !getAdminToken()) return <AuthLoading message="Redirecting to sign in…" />;

  return <>{children}</>;
}
