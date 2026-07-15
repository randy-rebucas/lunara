import type { Metadata } from 'next';
import brandIcon from '@lunara/brand/icon';
import { appConfig, marketingConfig } from '@lunara/config';
import type { FaqItem } from '../components/marketing/faq-data';
import type { ServiceArea } from '../components/marketing/home-page-data';

/** Canonical public origin for the default (non-white-label) brand. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? marketingConfig.websiteUrl).replace(
  /\/+$/,
  '',
);

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.lunara.customer';

export const DEFAULT_TITLE = `${appConfig.name} — Laundry Pickup & Delivery in Metro Manila`;

export const DEFAULT_DESCRIPTION =
  'Book door-to-door laundry in Metro Manila. Schedule a pickup in seconds, track your order live, pay with GCash, card, wallet, or cash, and get fresh clothes delivered back to you.';

export const SEO_KEYWORDS = [
  'laundry pickup and delivery',
  'laundry service Metro Manila',
  'wash and fold delivery',
  'dry cleaning pickup',
  'laundry app Philippines',
  'same day laundry service',
  appConfig.name,
];

export function absoluteUrl(path = '/'): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Rendered by src/app/opengraph-image.tsx; declared explicitly so every page gets og:image. */
export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${appConfig.name} — Laundry pickup & delivery in Metro Manila`,
} as const;

type PageMetadataInput = {
  /** Passed through the root `%s — Lunara` template unless `absoluteTitle` is set. */
  title: string;
  description: string;
  /** Route path starting with '/', used for the canonical URL and og:url. */
  path: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
};

/** Per-page metadata with canonical + Open Graph/Twitter fields filled in. */
export function buildPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
}: PageMetadataInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: path,
      siteName: appConfig.name,
      type: 'website',
      locale: 'en_PH',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/** Serializes structured data into a JSON-LD script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be embedded raw; data is app-controlled, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: appConfig.name,
    url: SITE_URL,
    logo: absoluteUrl(brandIcon.src),
    email: appConfig.supportEmail,
    sameAs: [PLAY_STORE_URL],
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: appConfig.name,
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: 'en-PH',
  };
}

export function laundryServiceJsonLd(cities: string[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${appConfig.name} laundry pickup & delivery`,
    serviceType: 'Laundry pickup and delivery',
    provider: { '@id': ORGANIZATION_ID },
    areaServed: cities.map((city) => ({
      '@type': 'City',
      name: city,
      containedInPlace: { '@type': 'Country', name: 'Philippines' },
    })),
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: absoluteUrl('/signup'),
    },
  };
}

export function mobileAppJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: `${appConfig.name} Customer`,
    operatingSystem: 'ANDROID',
    applicationCategory: 'LifestyleApplication',
    installUrl: PLAY_STORE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'PHP' },
  };
}

export function faqPageJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function serviceAreaJsonLd(branch: ServiceArea): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'DryCleaningOrLaundry',
    name: branch.name,
    url: absoluteUrl(`/service-areas/${branch.id}`),
    address: {
      '@type': 'PostalAddress',
      addressLocality: branch.city,
      addressRegion: branch.province,
      addressCountry: 'PH',
    },
    areaServed: branch.area,
    parentOrganization: { '@id': ORGANIZATION_ID },
  };
}
