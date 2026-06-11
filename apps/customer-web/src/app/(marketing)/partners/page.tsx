import type { Metadata } from 'next';
import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
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
      title="Partner with Lunara"
      description="Grow your laundry business by joining our pickup-and-delivery network."
      wide
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {BENEFITS.map((item) => (
          <article key={item.title} className="card h-full">
            <div className="card-body">
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="card mt-10">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">What we look for</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
            {REQUIREMENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-elevated mt-10">
        <div className="card-body bg-gradient-to-br from-primary/5 to-secondary/5 sm:py-8">
          <h2 className="text-xl font-semibold text-slate-900">Apply to become a partner</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Tell us about your laundry shop, location, and daily capacity. Our partnerships team will
            review your application and follow up with onboarding steps.
          </p>
          <div className="btn-row mt-6">
            <ButtonLink
              href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara partner application')}`}
              size="lg"
            >
              Email partnerships
            </ButtonLink>
            <ButtonLink href="/locations" variant="outline" size="lg">
              View service areas
            </ButtonLink>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/marketing" className="link-primary">
          ← Back to home
        </Link>
      </p>
    </MarketingContentPage>
  );
}
