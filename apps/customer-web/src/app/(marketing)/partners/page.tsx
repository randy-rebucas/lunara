import type { Metadata } from 'next';
import { Building2, LayoutDashboard, MapPin, Truck } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingInfoCard,
  MarketingSectionIcon,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../components/ui/button-link';

export const metadata: Metadata = {
  title: `Partner with ${appConfig.name}`,
  description: `Join the ${appConfig.name} network as a laundry partner. Reach more customers with pickup and delivery operations handled for you.`,
};

const BENEFITS = [
  {
    title: 'More orders, less marketing',
    description:
      'Lunara brings customers to you through the app and website. Focus on quality laundry while we handle discovery and booking.',
  },
  {
    title: 'Dispatch & rider network',
    description:
      'Our operations team assigns pickup and delivery riders so you do not need to build your own fleet from day one.',
  },
  {
    title: 'Partner portal',
    description:
      'Manage incoming orders, capacity, machine status, and daily quotas from a dedicated partner dashboard.',
  },
  {
    title: 'Branch-level control',
    description:
      'Set service radius, weight limits, and active order caps so your shop stays within comfortable operating limits.',
  },
] as const;

const REQUIREMENTS = [
  'Registered laundry business with a physical shop in Metro Manila (or expanding service areas)',
  'Reliable wash, dry, and fold capacity with basic quality standards',
  'Willingness to process Lunara orders within agreed turnaround times',
  'Point of contact available during operating hours for operations coordination',
] as const;

export default function PartnersPage() {
  return (
    <MarketingContentPage
      badge="For laundry shops"
      title="Partner with Lunara"
      description="Grow your laundry business by joining our pickup-and-delivery network."
      heroActions={
        <MarketingStatRow
          stats={[
            { icon: Building2, label: '50+ partner laundry shops' },
            { icon: MapPin, label: 'Metro Manila & expanding' },
            { icon: Truck, label: 'Dispatch & riders handled for you' },
          ]}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {BENEFITS.map((item) => (
          <MarketingFeatureCard key={item.title} title={item.title} description={item.description} />
        ))}
      </div>

      <div className="mt-10">
        <MarketingSectionIcon icon={LayoutDashboard} title="What we look for" />
        <MarketingInfoCard className="mt-4">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
            {REQUIREMENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </MarketingInfoCard>
      </div>

      <MarketingCtaPanel
        className="mt-10"
        badge="Apply today"
        variant="primary"
        title="Apply to become a partner"
        description="Tell us about your laundry shop, location, and daily capacity. Our partnerships team will review your application and follow up with onboarding steps."
      >
        <MarketingActions gap="loose">
          <ButtonLink href="/partners/apply" size="lg" layout="responsive">
            Apply to become a partner
          </ButtonLink>
          <ButtonLink href="/locations" variant="outline" size="lg" layout="responsive">
            View service areas
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink />
    </MarketingContentPage>
  );
}
