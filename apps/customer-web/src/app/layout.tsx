import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import brandIcon from '@lunara/brand/icon';
import { appConfig } from '@lunara/config';
import type { PartnerBrandConfig } from '@lunara/types';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

async function resolveBrandConfig(): Promise<PartnerBrandConfig | null> {
  const host = (await headers()).get('host');
  if (!host) return null;

  try {
    const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
    const res = await fetch(`${apiBase}/public/branding?domain=${encodeURIComponent(host)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const data = body?.data;
    if (!data || data.isDefault) return null;
    return data.brandConfig as PartnerBrandConfig;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveBrandConfig();
  return {
    title: `${brand?.appDisplayName ?? appConfig.name} — Customer`,
    description: appConfig.tagline,
    icons: {
      icon: brand?.faviconUrl ?? brandIcon.src,
      apple: brand?.iconUrl ?? brandIcon.src,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await resolveBrandConfig();
  const brandStyle = brand
    ? ({
        '--lunara-primary': brand.colors.primary,
        '--lunara-secondary': brand.colors.secondary,
        '--lunara-accent': brand.colors.accent,
        '--lunara-border': brand.colors.border,
      } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" className={inter.variable} style={brandStyle}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
