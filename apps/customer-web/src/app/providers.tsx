'use client';

import { AuthProvider } from '@lunara/hooks/auth-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
