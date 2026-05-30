import type { Metadata } from 'next';
import { AuthGuard } from '../components/auth-guard';
import { PortalShell } from '../components/portal-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lunara Partner Portal',
  description: 'Laundry shop operations — orders, staff, inventory, revenue',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <PortalShell>{children}</PortalShell>
        </AuthGuard>
      </body>
    </html>
  );
}
