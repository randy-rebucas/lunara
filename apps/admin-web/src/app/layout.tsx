import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthGuard } from '../components/auth-guard';
import { AdminShell } from '../components/admin-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lunara Admin',
  description: 'Platform administration — orders, riders, shops, revenue, support',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AuthGuard>
          <AdminShell>{children}</AdminShell>
        </AuthGuard>
      </body>
    </html>
  );
}
