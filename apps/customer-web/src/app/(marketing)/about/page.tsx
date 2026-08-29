import type { Metadata } from 'next';
import { Heart, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { STATS } from '../../../components/marketing/home-page-data';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingSectionIcon,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../components/ui/button-link';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'About us',
  description: `The story and mission behind ${appConfig.name} — connecting customers with trusted laundry partners and riders.`,
  path: '/about',
});

const VALUES = [
  {
    icon: Heart,
    title: 'Customer first',
    description: 'Every decision starts with what makes laundry day easier for the people who use us.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & reliability',
    description: 'We vet every partner shop and rider so your laundry is handled with care, every time.',
  },
  {
    icon: Sparkles,
    title: 'Simplicity',
    description: 'Booking, tracking, and paying should take minutes, not effort. We design for that.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'We grow by helping local laundry shops and riders build sustainable livelihoods.',
  },
] as const;

export default function AboutPage() {
  return (
    <MarketingContentPage
      badge="About us"
      title={`We're on a mission to make laundry effortless`}
      description={`${appConfig.name} connects customers with trusted local laundry shops and riders — so pickup, cleaning, and delivery just happen.`}
      heroActions={<MarketingStatRow stats={STATS.map(({ icon, value, label }) => ({ icon, label: `${value} ${label}` }))} />}
    >
      <div className="flex justify-center sm:justify-start">
        <MarketingSectionIcon icon={Target} title="Our story" />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {appConfig.name} started with a simple frustration: laundry takes time nobody has to spare.
        We set out to build a platform that connects busy customers with quality local laundry shops
        and reliable delivery riders — so a fresh, clean load is always just a few taps away. Today
        we work with partner shops and riders across Metro Manila, with more areas coming online as
        we grow.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {VALUES.map((value) => (
          <div key={value.title} className="card h-full">
            <div className="card-body">
              <MarketingSectionIcon icon={value.icon} title={value.title} />
              <p className="mt-3 text-sm leading-relaxed text-muted">{value.description}</p>
            </div>
          </div>
        ))}
      </div>

      <MarketingCtaPanel
        className="mt-14"
        badge="Join us"
        title="Ready to try it yourself?"
        description="Book your first pickup in minutes."
        align="center"
      >
        <MarketingActions align="center" gap="loose">
          <ButtonLink href="/signup" size="lg" layout="responsive">
            Book laundry pickup
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink />
    </MarketingContentPage>
  );
}
