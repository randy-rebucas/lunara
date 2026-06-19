'use client';

import Link from 'next/link';

import { useRouter } from 'next/navigation';

import { useEffect, useState } from 'react';

import QRCode from 'react-qr-code';

import { appConfig } from '@lunara/config';

import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';

import { useAuthContext } from '@lunara/hooks/auth-provider';

import { AuthLoading } from '../auth-loading';

import { ButtonAnchor, ButtonLink } from '../ui/button-link';

import { MarketingActions } from './marketing-actions';

import {
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingGradientText,
  MarketingHeroGlow,
  MarketingSection,
  MarketingSectionHeader,
} from './marketing-design';

import { MarketingShell } from './marketing-shell';

import {
  CUSTOMER_REVIEWS,
  EXPANDING_AREAS,
  HERO_STATS,
  HOW_IT_WORKS,
  PARTNER_HIGHLIGHTS,
  SERVICE_AREAS,
  WHY_CHOOSE,
} from './home-page-data';

const accentBadge = {
  primary: 'primary',

  secondary: 'secondary',

  accent: 'accent',
} as const;

function StarRating({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5 text-amber-500" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

const ANDROID_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.lunara.customer&pcampaignid=web_share';

function GooglePlayQrModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Download on Google Play"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="float-right -mr-2 -mt-2 rounded-full p-2 text-muted-foreground transition hover:bg-slate-100"
        >
          ✕
        </button>

        <p className="text-sm font-semibold text-slate-900">Get the app on Google Play</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Scan with your phone camera to download
        </p>

        <div className="mx-auto mt-5 inline-block rounded-lg bg-white p-4 ring-1 ring-border/60">
          <QRCode value={ANDROID_PLAY_STORE_URL} size={180} />
        </div>

        <Link
          href={ANDROID_PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open Google Play
        </Link>
      </div>
    </div>
  );
}

function AppStoreBadge({ store }: { store: 'ios' | 'android' }) {
  const isIos = store === 'ios';
  const [showQr, setShowQr] = useState(false);

  if (isIos) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-11 w-full cursor-not-allowed flex-col justify-center rounded-lg bg-slate-900/40 px-5 py-3 text-left text-white/40 ring-1 ring-slate-800/40 sm:min-h-12 sm:min-w-[12rem] sm:w-auto sm:px-6"
      >
        <span className="block text-[10px] uppercase tracking-wide text-slate-400/60">
          Coming soon to the
        </span>

        <span className="block text-sm font-semibold">App Store</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowQr(true)}
        className="inline-flex min-h-11 w-full flex-col justify-center rounded-lg bg-slate-900 px-5 py-3 text-left text-white ring-1 ring-slate-800 transition hover:bg-slate-800 sm:min-h-12 sm:min-w-[12rem] sm:w-auto sm:px-6"
      >
        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Get it on</span>

        <span className="block text-sm font-semibold">Google Play</span>
      </button>

      {showQr ? <GooglePlayQrModal onClose={() => setShowQr(false)} /> : null}
    </>
  );
}

export function HomePage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();

  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    fetchOnboardingStatus(api).then((status) => {
      router.replace(getOnboardingPath(status));
    });
  }, [isLoading, isAuthenticated, api, router]);

  if (isLoading) return <AuthLoading />;

  if (isAuthenticated) return <AuthLoading message="Redirecting…" />;

  return (
    <MarketingShell>
      <section className="marketing-container relative overflow-hidden pb-20 pt-12 sm:pt-16 lg:pb-28 lg:pt-20">
        <MarketingHeroGlow />

        <div className="relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="badge-primary">Philippines · Door-to-door laundry</span>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Laundry pickup &amp; delivery,{' '}
              <MarketingGradientText>done for you</MarketingGradientText>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {appConfig.name} connects you with trusted laundry partners and riders. Book a pickup,
              track every step, and get fresh clothes back to your door.
            </p>

            <MarketingActions className="mt-8" gap="loose">
              <ButtonLink href="/signup" size="lg" layout="responsive">
                Book laundry pickup
              </ButtonLink>

              <ButtonLink href="/#download-app" variant="outline" size="lg" layout="responsive">
                Download app
              </ButtonLink>
            </MarketingActions>

            <p className="mt-4 text-sm text-muted-foreground">
              No credit card to sign up · Works on web and mobile
            </p>
          </div>

          <div className="card-elevated relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="card-body space-y-5 bg-gradient-to-br from-primary/5 via-surface to-secondary/5 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Your next pickup
              </p>

              <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">Wash &amp; Fold</span>

                  <span className="text-primary">~₱400</span>
                </div>

                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Tomorrow · 8–10 AM</span>

                  <span className="badge-accent">Live tracking</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {HERO_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-surface/80 px-2 py-3 text-center ring-1 ring-border/40"
                  >
                    <p className="text-lg font-bold text-primary">{stat.value}</p>

                    <p className="mt-0.5 text-[10px] leading-tight text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingSection
        id="download-app"
        tint="muted"
        className="border-y border-border/40 bg-surface/70"
      >
        <MarketingCtaPanel
          variant="dark"
          title={`Get the ${appConfig.name} app`}
          description="Book pickups, track riders, pay with GCash or wallet, and get notified when your laundry is on the way — all from your phone."
        >
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-end">
              <AppStoreBadge store="ios" />

              <AppStoreBadge store="android" />
            </div>

            <p className="text-xs text-slate-400">
              Or{' '}
              <Link
                href="/signup"
                className="font-medium text-white underline-offset-2 hover:underline"
              >
                sign up on the web
              </Link>{' '}
              — same account everywhere
            </p>
          </div>
        </MarketingCtaPanel>
      </MarketingSection>

      <MarketingSection>
        <MarketingCtaPanel
          badge="Ready when you are"
          badgeVariant="secondary"
          title="Book your laundry pickup today"
          description="Choose a service, pick a time window, and confirm your price. We'll handle pickup, cleaning, and delivery."
          layout="split"
        >
          <MarketingActions align="center" gap="loose" className="w-full sm:w-auto">
            <ButtonLink href="/signup" size="lg" layout="responsive">
              Book laundry pickup
            </ButtonLink>

            <ButtonLink href="/login" variant="outline" size="lg" layout="responsive">
              Sign in
            </ButtonLink>
          </MarketingActions>
        </MarketingCtaPanel>
      </MarketingSection>

      <MarketingSection id="how-it-works" tint="muted">
        <MarketingSectionHeader
          title="How Lunara works"
          description="Four steps from dirty laundry to fresh and delivered."
        />

        <ol className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="card h-full">
              <div className="card-body flex gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
                  aria-hidden
                >
                  {item.step}
                </span>

                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection id="service-areas">
        <MarketingSectionHeader
          title="Service areas"
          description="Live pickup and delivery across Metro Manila. Enter your address when booking to confirm coverage."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {SERVICE_AREAS.map((branch) => (
            <MarketingFeatureCard
              key={branch.name}
              badge={branch.province}
              title={branch.name}
              subtitle={branch.city}
              description={branch.area}
            >
              <p className="mt-4 text-xs text-muted-foreground">
                ~{branch.radiusKm} km service radius
              </p>
            </MarketingFeatureCard>
          ))}
        </div>

        <div className="card mt-8">
          <div className="card-body text-center sm:text-left">
            <h3 className="font-semibold text-slate-900">Expanding soon</h3>

            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {EXPANDING_AREAS.map((city) => (
                <li
                  key={city}
                  className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-slate-700 ring-1 ring-border/60"
                >
                  {city}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-center sm:justify-start">
              <ButtonLink href="/locations" variant="outline" size="sm" layout="responsive">
                View all locations
              </ButtonLink>
            </div>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="why-lunara" tint="muted">
        <MarketingSectionHeader
          title="Why choose Lunara"
          description="Built for busy households and professionals who want laundry off their to-do list."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE.map((item) => (
            <MarketingFeatureCard
              key={item.title}
              badge={item.label}
              badgeVariant={accentBadge[item.accent]}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="reviews">
        <MarketingSectionHeader
          title="Customer reviews"
          description={`What customers say about booking with ${appConfig.name}.`}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CUSTOMER_REVIEWS.map((review) => (
            <blockquote key={review.name} className="card h-full">
              <div className="card-body flex h-full flex-col">
                <StarRating count={review.rating} />

                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  &ldquo;{review.quote}&rdquo;
                </p>

                <footer className="mt-4 border-t border-border/40 pt-4">
                  <p className="font-semibold text-slate-900">{review.name}</p>

                  <p className="text-xs text-muted">{review.location}</p>
                </footer>
              </div>
            </blockquote>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="partners" tint="muted">
        <MarketingSectionHeader
          title="Partner highlights"
          description={`Quality laundry shops on the ${appConfig.name} network — vetted, tracked, and supported by our operations team.`}
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PARTNER_HIGHLIGHTS.map((partner) => (
            <MarketingFeatureCard
              key={partner.name}
              badge={partner.city}
              badgeVariant="secondary"
              title={partner.name}
              subtitle={partner.specialty}
              description={partner.highlight}
            />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="pb-20 sm:pb-28" containerClassName="pt-0">
        <div className="grid gap-6 lg:grid-cols-2">
          <MarketingCtaPanel
            badge="For laundry shops"
            variant="primary"
            title="Become a partner"
            description={`Join the ${appConfig.name} network. We bring customers, handle pickup and delivery dispatch, and give you a partner portal to manage orders and capacity.`}
          >
            <MarketingActions gap="loose">
              <ButtonLink href="/partners" size="lg" layout="responsive">
                Learn about partnering
              </ButtonLink>

              <ButtonAnchor
                href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara partner application')}`}
                variant="outline"
                size="lg"
                layout="responsive"
              >
                Apply now
              </ButtonAnchor>
            </MarketingActions>
          </MarketingCtaPanel>

          <MarketingCtaPanel
            badge="For riders"
            badgeVariant="secondary"
            variant="secondary"
            title="Become a rider"
            description="Earn on your schedule with clear pickup and delivery tasks, proof-of-handoff flows, and earnings tracking in the Lunara Rider app."
          >
            <MarketingActions gap="loose">
              <ButtonLink href="/riders" size="lg" layout="responsive">
                Drive with Lunara
              </ButtonLink>

              <ButtonAnchor
                href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent('Lunara rider application')}`}
                variant="outline"
                size="lg"
                layout="responsive"
              >
                Apply to drive
              </ButtonAnchor>
            </MarketingActions>
          </MarketingCtaPanel>
        </div>
      </MarketingSection>
    </MarketingShell>
  );
}
