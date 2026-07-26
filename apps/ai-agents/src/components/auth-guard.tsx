'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthLoading } from './auth-loading';
import { getAuthToken } from '../lib/ai-agents-api';
import { useAiAgentsAuth } from '../lib/auth-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady } = useAiAgentsAuth();

  const isPublicRoute = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (!isReady) return;
    if (isPublicRoute) return;
    if (!getAuthToken()) {
      router.replace('/login');
    }
  }, [pathname, router, isReady, isPublicRoute]);

  if (!isReady) return <AuthLoading message="Checking session…" />;
  if (!isPublicRoute && !getAuthToken()) {
    return <AuthLoading message="Redirecting to sign in…" />;
  }

  return <>{children}</>;
}
