import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import brandIcon from '@lunara/brand/icon';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export const metadata: Metadata = {
  title: 'App Builder — Lunara',
  description: 'Preview a white-labeled Lunara app with your own logo and colors, then submit your partner interest.',
  icons: { icon: brandIcon.src, apple: brandIcon.src },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
