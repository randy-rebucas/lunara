import type { Metadata } from 'next';
import { AuthGuard } from '../components/auth-guard';
import { AdminShell } from '../components/admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lunara Admin',
  description: 'Platform administration — orders, riders, shops, revenue, support',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <AdminShell>{children}</AdminShell>
        </AuthGuard>
      </body>
    </html>
  );
}
