'use client';

import { AuthProvider } from '@lunara/hooks/auth-provider';
import { CustomerTrackingSync } from '../components/customer-tracking-sync';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CustomerTrackingSync />
      {children}
    </AuthProvider>
  );
}
