import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import brandIcon from '@lunara/brand/icon';
import { AuthGuard } from '../components/auth-guard';
import { BrandingProvider } from '../components/branding-provider';
import { ErrorBoundary } from '../components/error-boundary';
import { PortalShell } from '../components/portal-shell';
import { ServiceWorkerRegister } from '../components/sw-register';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lunara Business Account',
  description: 'Laundry shop operations — orders, staff, inventory, revenue',
  manifest: '/manifest.json',
  icons: {
    icon: brandIcon.src,
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lunara Partner',
  },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <ErrorBoundary>
          <AuthGuard>
            <BrandingProvider>
              <PortalShell>{children}</PortalShell>
            </BrandingProvider>
          </AuthGuard>
        </ErrorBoundary>
        <Toaster position="bottom-right" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
