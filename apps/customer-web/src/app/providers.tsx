'use client';

import { AuthProvider } from '@lunara/hooks/auth-provider';
import { CustomerTrackingSync } from '../components/customer-tracking-sync';
import { ChatWidget } from '../components/chat/chat-widget';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CustomerTrackingSync />
      {children}
      <ChatWidget />
    </AuthProvider>
  );
}
