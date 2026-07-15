import type { Metadata } from 'next';
import { HomePage } from '../../components/marketing/home-page';
import { SERVICE_AREAS } from '../../components/marketing/home-page-data';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  JsonLd,
  buildPageMetadata,
  laundryServiceJsonLd,
  mobileAppJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from '../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
});

export default function MarketingHomePage() {
  const cities = [...new Set(SERVICE_AREAS.map((area) => area.city))];

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={webSiteJsonLd()} />
      <JsonLd data={laundryServiceJsonLd(cities)} />
      <JsonLd data={mobileAppJsonLd()} />
      <HomePage />
    </>
  );
}
