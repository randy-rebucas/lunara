import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import { headers } from 'next/headers';
import brandIcon from '@lunara/brand/icon';
import { appConfig } from '@lunara/config';
import type { PartnerBrandConfig } from '@lunara/types';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE,
  SEO_KEYWORDS,
  SITE_URL,
} from '../lib/seo';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Signage/display face for the jeepney destination-board home redesign — headlines and
// route/placard labels only; body copy stays on Inter. See the direction contract below.
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveBrandConfig();

  // White-label domains keep their own identity and must not canonicalize to
  // the default Lunara origin, so they only get the basic fields.
  if (brand) {
    return {
      title: `${brand.appDisplayName} — Customer`,
      description: appConfig.tagline,
      icons: {
        icon: brand.faviconUrl ?? brandIcon.src,
        apple: brand.iconUrl ?? brandIcon.src,
      },
      robots: { index: true, follow: true },
    };
  }

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s — ${appConfig.name}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: appConfig.name,
    keywords: SEO_KEYWORDS,
    category: 'Laundry service',
    creator: appConfig.name,
    publisher: appConfig.name,
    alternates: { canonical: '/' },
    icons: {
      icon: brandIcon.src,
      apple: brandIcon.src,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      url: '/',
      siteName: appConfig.name,
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      locale: 'en_PH',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [OG_IMAGE.url],
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
    <html lang="en" className={`${inter.variable} ${anton.variable}`} style={brandStyle}>
      <body className="min-h-screen font-sans antialiased">
        {/*
          DIRECTION CONTRACT — customer-web home page (seed 4fbe65fa, "Jeepney destination signage")
          THESIS: the jeepney destination board replaces the generic delivery-app hero; an order is a
          route with real stops (Pickup -> Wash Partner -> Delivery), dramatizing Lunara's real
          differentiator: a network of shops/riders running a route, not one storefront.
          OWN-WORLD: saturated jeepney-enamel palette (candy-red/marigold/cobalt/black outline) on an
          enamel-white ground as a semantic layer over --color-primary (white-label still overrides
          primary); display headlines in self-hosted Anton, body stays Inter; page composed as a route
          line connecting "stops" (hero=board, how-it-works=placards, features=capabilities, service
          areas=route map, pricing=fare board, reviews=passenger testimonials, footer=board this
          route); icons wrapped in painted placard chrome (thick black outline, flat enamel color).
          STORY: visitor reads their laundry as a physical route, feels the local/energetic/trustworthy
          network character, and books a pickup.
          FIRST VIEWPORT: full-width route-board hero, 3 painted destination placards along a route
          line, ticket-style primary CTA, phone trio restyled into the board.
          FORM: "Jeepney destination signage," direction 4, seed key 4fbe65fa.
        */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
