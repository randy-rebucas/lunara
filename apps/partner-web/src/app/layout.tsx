import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import brandIcon from '@lunara/brand/icon';
import { AuthGuard } from '../components/auth-guard';
import { PortalShell } from '../components/portal-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lunara Partner Portal',
  description: 'Laundry shop operations — orders, staff, inventory, revenue',
  icons: {
    icon: brandIcon.src,
    apple: brandIcon.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AuthGuard>
          <PortalShell>{children}</PortalShell>
        </AuthGuard>
      </body>
    </html>
  );
}
