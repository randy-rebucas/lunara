'use client';

import { useProtectedPage } from '../hooks/use-protected-page';
import { AuthLoading } from './auth-loading';

/** Layout gate for `(authenticated)` routes — redirects guests to login. */
export function AuthenticatedGate({ children }: { children: React.ReactNode }) {
  const { isLoading, ready } = useProtectedPage({ loginPath: '/login' });

  if (isLoading || !ready) {
    return <AuthLoading />;
  }

  return <>{children}</>;
}
