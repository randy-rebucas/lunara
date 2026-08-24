import type { Metadata } from 'next';
import { ArrowRight, Check, Sparkles, Wallet } from 'lucide-react';
import { cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';
import { HOW_IT_WORKS, PRICING_TIERS } from '../../../components/marketing/home-page-data';
import { MarketingContentPage } from '../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingSectionHeader,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { Reveal } from '../../../components/marketing/reveal';
import { ButtonLink } from '../../../components/ui/button-link';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'How It Works & Pricing',
  description: `See how ${appConfig.name} pickup, cleaning, and delivery works, and browse pricing for wash & fold, dry cleaning, and express service.`,
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return (
    <MarketingContentPage
      badge="How it works"
      title={`Fresh laundry in four easy steps`}
      description="Book a pickup, we handle the rest. Here's exactly what happens from the moment you schedule to the moment your clean laundry is back at your door."
      heroActions={
        <MarketingStatRow
          stats={[
            { icon: Sparkles, label: 'Upfront pricing, no surprises' },
            { icon: Wallet, label: 'Pay by cash, GCash, or card' },
          ]}
        />
      }
    >
      <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {HOW_IT_WORKS.map((item, index) => (
          <Reveal
            as="li"
            key={item.step}
            delay={index * 80}
            className="relative flex flex-col items-center text-center"
          >
            <div className="relative">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="h-7 w-7" aria-hidden />
              </span>
              <span
                className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
                aria-hidden
              >
                {item.step}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted">
              {item.description}
            </p>
            {index < HOW_IT_WORKS.length - 1 ? (
              <ArrowRight
                className="absolute -right-4 top-6 hidden h-5 w-5 text-primary/40 lg:block"
                aria-hidden
              />
            ) : null}
          </Reveal>
        ))}
      </ol>

      <div id="pricing" className="mt-20 scroll-mt-24">
        <MarketingSectionHeader
          title="Simple, upfront pricing"
          description="Prices start here — your final total is confirmed at checkout based on the actual weight and services you choose."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRICING_TIERS.map((tier, index) => (
            <Reveal
              as="div"
              key={tier.service}
              delay={index * 70}
              className="card-elevated flex h-full flex-col p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated-lg)] sm:p-8"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <tier.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className={cn('shrink-0', `badge-${tier.badgeVariant}`)}>{tier.badge}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{tier.service}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary">{tier.from}</span>
                <span className="text-sm text-muted">{tier.unit}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {tier.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2 text-sm text-muted">
                    <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {highlight}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ButtonLink href="/signup" size="sm" layout="responsive">
                  Book now
                </ButtonLink>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Final prices confirmed at checkout based on actual weight and service selection.
        </p>
      </div>

      <MarketingCtaPanel
        className="mt-16"
        badge="Ready when you are"
        title="Book your first pickup today"
        description="Schedule in under a minute — pick a time, add your address, and we'll take it from there."
        align="center"
      >
        <MarketingActions align="center" gap="loose">
          <ButtonLink href="/signup" size="lg" layout="responsive">
            Get started
          </ButtonLink>
          <ButtonLink href="/faq" variant="outline" size="lg" layout="responsive">
            Read the FAQ
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink />
    </MarketingContentPage>
  );
}
