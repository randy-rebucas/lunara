import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import brandIcon from '@lunara/brand/icon';
import { appConfig } from '@lunara/config';
import { AuthGuard } from '../components/auth-guard';
import { AdminShell } from '../components/admin-shell';
import { AdminSosProvider } from '../components/admin-sos-provider';
import { AdminAuthProvider } from '../lib/admin-auth-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${appConfig.name} Admin`,
  description: 'Platform administration — orders, riders, shops, revenue, support',
  icons: {
    icon: brandIcon.src,
    apple: brandIcon.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AdminAuthProvider>
          <AuthGuard>
            <AdminSosProvider>
              <AdminShell>{children}</AdminShell>
            </AdminSosProvider>
          </AuthGuard>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
