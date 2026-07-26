import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import brandIcon from '@lunara/brand/icon';
import { AuthGuard } from '../components/auth-guard';
import { AiAgentsAuthProvider } from '../lib/auth-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lunara AI Team',
  description: 'Chat with Lunara\'s internal AI team of specialists',
  icons: {
    icon: brandIcon.src,
    apple: brandIcon.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <AiAgentsAuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AiAgentsAuthProvider>
      </body>
    </html>
  );
}
