import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import brandIcon from '@lunara/brand/icon';
import { appConfig } from '@lunara/config';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${appConfig.name} — Customer`,
  description: appConfig.tagline,
  icons: {
    icon: brandIcon.src,
    apple: brandIcon.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
