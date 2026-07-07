import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingInfoCard,
} from '../../../components/marketing/marketing-design';
import {
  EXPANDING_AREAS,
  fetchActiveServiceAreas,
} from '../../../components/marketing/home-page-data';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../components/ui/button-link';
import { resolveApiV1BaseUrl } from '@lunara/hooks';

export const metadata: Metadata = {
  title: `Service areas — ${appConfig.name}`,
  description: `See where ${appConfig.name} offers laundry pickup and delivery in Metro Manila.`,
};

export default async function LocationsPage() {
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const serviceAreas = await fetchActiveServiceAreas(apiBase);

  return (
    <MarketingContentPage
      badge="Metro Manila"
      title="Service locations"
      description="Lunara partner branches and pickup zones across Metro Manila. Enter your address when booking to confirm coverage."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {serviceAreas.map((branch) => (
          <MarketingFeatureCard
            key={branch.id}
            href={`/service-areas/${branch.id}`}
            badge={branch.province}
            title={branch.name}
            subtitle={branch.city}
            description={branch.area}
          >
            <p className="mt-4 text-xs text-muted-foreground">
              Approx. {branch.radiusKm} km service radius from branch
            </p>
          </MarketingFeatureCard>
        ))}
      </div>

      <MarketingInfoCard title="Expanding soon" className="mt-10">
        <p className="text-sm text-muted">
          We are growing across the Philippines. These areas are on our roadmap — join the waitlist by
          booking with your address or contacting support.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {EXPANDING_AREAS.map((city) => (
            <li
              key={city}
              className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-slate-700 ring-1 ring-border/60"
            >
              {city}
            </li>
          ))}
        </ul>
      </MarketingInfoCard>

      <MarketingCtaPanel
        className="mt-10"
        title="Check coverage at your address"
        description="Availability depends on your pin location and nearest active branch. Sign up and add your address to see if pickup and delivery are available today."
        align="center"
      >
        <MarketingActions align="center" gap="loose">
          <ButtonLink href="/signup" size="lg" layout="responsive">
            Check my address
          </ButtonLink>
          <ButtonLink href="/signup" variant="outline" size="lg" layout="responsive">
            Book laundry
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink
        extra={
          <>
            {' · '}
            <Link href="/partners" className="link-primary">
              Partner with us
            </Link>
          </>
        }
      />
    </MarketingContentPage>
  );
}
