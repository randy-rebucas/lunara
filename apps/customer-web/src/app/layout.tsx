import type { Metadata } from 'next';
import { appConfig } from '@lunara/config';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: `${appConfig.name} — Customer`,
  description: appConfig.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
