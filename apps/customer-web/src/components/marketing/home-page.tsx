'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  ArrowRight,
  Bike,
  Check,
  MapPin,
  Phone,
  Store,
  X,
} from 'lucide-react';
import { cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { AuthLoading } from '../auth-loading';
import { ButtonLink } from '../ui/button-link';
import { Carousel } from '../ui/carousel';
import { MarketingActions } from './marketing-actions';
import {
  MarketingSection,
  MarketingSectionHeader,
  accentClasses,
} from './marketing-design';
import { MarketingShell } from './marketing-shell';
import {
  PhoneFrame,
  ScreenBooking,
  ScreenHome,
  ScreenNotifications,
  ScreenRewards,
  ScreenTracking,
} from './phone-mockup';
import {
  CUSTOMER_REVIEWS,
  EXPANDING_AREAS,
  FEATURES,
  HOME_FAQS,
  HOW_IT_WORKS,
  PARTNER_BENEFITS,
  PRICING_TIERS,
  SERVICE_AREAS,
  STATS,
  TRUST_CHIPS,
  fetchActiveServiceAreas,
  type ServiceArea,
} from './home-page-data';

const avatarBg: Record<'primary' | 'secondary' | 'accent', string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
};

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
          <X className="h-4 w-4" aria-hidden />
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
        className="inline-flex min-h-11 w-full cursor-not-allowed flex-col justify-center rounded-lg bg-slate-900/40 px-5 py-3 text-left text-white/40 ring-1 ring-slate-800/40 sm:min-h-12 sm:min-w-[11rem] sm:w-auto sm:px-6"
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
        className="inline-flex min-h-11 w-full flex-col justify-center rounded-lg bg-slate-900 px-5 py-3 text-left text-white ring-1 ring-slate-800 transition hover:bg-slate-800 sm:min-h-12 sm:min-w-[11rem] sm:w-auto sm:px-6"
      >
        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Get it on</span>
        <span className="block text-sm font-semibold">Google Play</span>
      </button>

      {showQr ? <GooglePlayQrModal onClose={() => setShowQr(false)} /> : null}
    </>
  );
}

function HeroBubbles() {
  return (
    <>
      <span className="bubble left-[4%] top-[12%] hidden h-16 w-16 lg:block" aria-hidden />
      <span className="bubble right-[2%] top-[6%] hidden h-24 w-24 lg:block" aria-hidden />
      <span className="bubble bottom-[8%] right-[38%] hidden h-10 w-10 lg:block" aria-hidden />
      <span className="bubble bottom-[18%] left-[42%] hidden h-6 w-6 lg:block" aria-hidden />
    </>
  );
}

function FaqChevron() {
  return (
    <svg
      className="faq-chevron h-5 w-5 shrink-0 text-muted transition-transform duration-200"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function HomePage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([...SERVICE_AREAS]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      router.replace(getOnboardingPath(status));
    });
  }, [isLoading, isAuthenticated, api, router]);

  useEffect(() => {
    const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
    fetchActiveServiceAreas(apiBase).then(setServiceAreas);
  }, []);

  // Render marketing content during the auth check so crawlers and first paint
  // get the real page; only swap to the loader once we know we're redirecting.
  if (isAuthenticated) return <AuthLoading message="Redirecting…" />;

  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/80 via-surface-muted to-surface-muted">
        <div className="marketing-container relative pb-16 pt-12 sm:pt-16 lg:pb-24 lg:pt-20">
          <HeroBubbles />

          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
            <div className="max-w-xl">
              <span className="badge-primary">Philippines · Door-to-door laundry</span>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                Laundry day,
                <br />
                <span className="text-primary">simplified.</span>
              </h1>

              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Book laundry pickup in seconds. Track your order in real time, pay securely, and
                have freshly cleaned clothes delivered back to your doorstep.
              </p>

              <MarketingActions className="mt-8" gap="loose">
                <ButtonLink href="/signup" size="lg" layout="responsive">
                  Book a pickup
                </ButtonLink>
                <ButtonLink href="/partners" variant="outline" size="lg" layout="responsive">
                  Become a partner
                </ButtonLink>
              </MarketingActions>

              {/* Trust chips */}
              <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                {TRUST_CHIPS.map((chip) => (
                  <div key={chip.title} className="flex flex-col items-start gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <chip.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <dt className="text-sm font-semibold text-slate-900">{chip.title}</dt>
                      <dd className="text-xs text-muted">{chip.subtitle}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* Phone trio */}
            <div className="relative mx-auto flex items-center justify-center">
              <PhoneFrame className="z-0 hidden -rotate-6 sm:block sm:-mr-10 sm:w-48">
                <ScreenHome />
              </PhoneFrame>
              <PhoneFrame className="z-10 w-56 sm:w-60">
                <ScreenBooking />
              </PhoneFrame>
              <PhoneFrame className="z-0 hidden rotate-6 sm:block sm:-ml-10 sm:w-48">
                <ScreenTracking />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ── Founding partners strip ── */}
      <section aria-label="Founding partners" className="border-y border-border/40 bg-surface">
        <div className="marketing-container py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Trusted by our founding partners
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {serviceAreas.slice(0, 4).map((branch) => (
              <li key={branch.id}>
                <Link
                  href={`/service-areas/${branch.id}`}
                  className="text-lg font-bold tracking-tight text-slate-400 transition-colors hover:text-primary"
                >
                  {branch.name}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-2 text-sm font-medium text-muted">
              <Store className="h-4 w-4 text-primary" aria-hidden />
              More partner laundries coming soon
            </li>
          </ul>
        </div>
      </section>

      {/* ── Features ── */}
      <MarketingSection id="features">
        <MarketingSectionHeader
          title="Everything laundry, handled"
          description="Built for busy households and professionals who want laundry off their to-do list."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const accent = accentClasses(feature.accent);
            return (
              <article
                key={feature.title}
                className="card flex h-full flex-col p-6 hover:shadow-[var(--shadow-elevated)]"
              >
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl',
                    accent.bg,
                  )}
                >
                  <feature.icon className={cn('h-5 w-5', accent.text)} aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </MarketingSection>

      {/* ── How it works ── */}
      <MarketingSection id="how-it-works" tint="muted">
        <MarketingSectionHeader
          title={`How ${appConfig.name} works`}
          description="Four steps from dirty laundry to fresh and delivered."
        />

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {HOW_IT_WORKS.map((item, index) => (
            <li key={item.step} className="relative flex flex-col items-center text-center">
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
            </li>
          ))}
        </ol>
      </MarketingSection>

      {/* ── App showcase ── */}
      <MarketingSection>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Everything you need in one app
            </h2>
            <p className="mt-3 text-muted">
              Simple, fast, and convenient laundry service at your fingertips.
            </p>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row lg:max-w-56 lg:flex-col">
              <AppStoreBadge store="android" />
              <AppStoreBadge store="ios" />
            </div>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PhoneFrame className="w-44" label="Home">
              <ScreenHome />
            </PhoneFrame>
            <PhoneFrame className="w-44" label="Booking">
              <ScreenBooking />
            </PhoneFrame>
            <PhoneFrame className="w-44" label="Tracking">
              <ScreenTracking />
            </PhoneFrame>
            <PhoneFrame className="w-44" label="Rewards">
              <ScreenRewards />
            </PhoneFrame>
            <PhoneFrame className="w-44" label="Notifications">
              <ScreenNotifications />
            </PhoneFrame>
          </div>
        </div>
      </MarketingSection>

      {/* ── Partner growth + live tracking ── */}
      <MarketingSection tint="muted">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grow your laundry business */}
          <div className="card-elevated flex flex-col p-8 sm:p-10">
            <span className="badge-primary w-fit">For laundry shops</span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Grow your laundry business with {appConfig.name}
            </h2>
            <p className="mt-3 text-muted">
              Join {appConfig.name} and receive more customers without spending thousands on
              marketing.
            </p>

            <ul className="mt-6 grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {PARTNER_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>

            <MarketingActions className="mt-8">
              <ButtonLink href="/partners/apply" size="lg" layout="responsive">
                Become a founding partner
              </ButtonLink>
              <ButtonLink href="/partners" variant="outline" size="lg" layout="responsive">
                Learn more
              </ButtonLink>
            </MarketingActions>
          </div>

          {/* Real-time tracking */}
          <div className="card-elevated relative flex flex-col overflow-hidden bg-slate-900 p-8 text-white sm:p-10">
            {/* Grid backdrop + route line */}
            <div
              className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgb(148_163_184/0.3)_1px,transparent_1px),linear-gradient(90deg,rgb(148_163_184/0.3)_1px,transparent_1px)] [background-size:32px_32px]"
              aria-hidden
            />
            <svg viewBox="0 0 200 120" className="absolute inset-x-0 bottom-0 h-40 w-full" aria-hidden>
              <path
                d="M-10 110 C 40 80, 60 110, 100 70 S 170 40, 210 20"
                fill="none"
                stroke="rgb(96 165 250 / 0.5)"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
            </svg>

            <div className="relative">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-200 ring-1 ring-white/15">
                Live on every order
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Real-time tracking
              </h2>
              <p className="mt-3 text-slate-300">Stay updated every step of the way.</p>
            </div>

            {/* Rider card */}
            <div className="relative mt-8 max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  JD
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Rider assigned</p>
                  <p className="truncate font-semibold">John D.</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Phone className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-muted p-3">
                  <dt className="text-xs text-muted">ETA</dt>
                  <dd className="mt-0.5 font-semibold">12 mins</dd>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <dt className="text-xs text-muted">Status</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                    On the way
                  </dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Bike className="h-3.5 w-3.5 text-primary" aria-hidden />
                {serviceAreas[0]?.name ?? 'Your laundry shop'}
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* ── Reviews + stats ── */}
      <MarketingSection id="reviews">
        <MarketingSectionHeader
          title="Loved by our customers"
          description={`What customers say about booking with ${appConfig.name}.`}
        />

        <Carousel
          className="mt-12"
          items={CUSTOMER_REVIEWS}
          getKey={(review) => review.name}
          renderItem={(review) => (
            <blockquote className="card h-full">
              <div className="card-body flex h-full flex-col">
                <StarRating count={review.rating} />

                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  &ldquo;{review.quote}&rdquo;
                </p>

                <footer className="mt-4 flex items-center gap-3 border-t border-border/40 pt-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarBg[review.avatarColor]}`}
                    aria-hidden
                  >
                    {review.initials}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{review.name}</p>
                    <p className="text-xs text-muted">{review.location} · Verified customer</p>
                  </div>
                </footer>
              </div>
            </blockquote>
          )}
        />

        <dl className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <stat.icon className="h-6 w-6" aria-hidden />
              </span>
              <dt className="order-2 mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                {stat.label}
              </dt>
              <dd className="order-1 mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </MarketingSection>

      {/* ── Service areas ── */}
      <MarketingSection id="service-areas" tint="muted">
        <MarketingSectionHeader
          title="Service areas"
          description="Live pickup and delivery across Metro Manila. Enter your address when booking to confirm coverage."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {serviceAreas.slice(0, 3).map((branch) => (
            <Link
              key={branch.id}
              href={`/service-areas/${branch.id}`}
              className="card flex h-full flex-col p-6 hover:shadow-[var(--shadow-elevated)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{branch.name}</h3>
              <p className="mt-0.5 text-sm font-medium text-primary">{branch.city}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{branch.area}</p>
              <p className="mt-4 text-xs text-muted-foreground">
                ~{branch.radiusKm} km service radius
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <ul className="flex flex-wrap justify-center gap-2">
            {EXPANDING_AREAS.map((city) => (
              <li
                key={city}
                className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] ring-1 ring-border/50"
              >
                {city} · soon
              </li>
            ))}
          </ul>
          <ButtonLink href="/locations" variant="outline" size="sm" layout="inline">
            View all locations
          </ButtonLink>
        </div>
      </MarketingSection>

      {/* ── Pricing ── */}
      <MarketingSection id="pricing">
        <MarketingSectionHeader
          title="Simple, transparent pricing"
          description="Know what you'll pay before you confirm. No hidden fees."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.service}
              className="card-elevated flex h-full flex-col p-6 hover:shadow-[var(--shadow-elevated-lg)] sm:p-8"
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
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Final prices confirmed at checkout based on actual weight and service selection.
        </p>
      </MarketingSection>

      {/* ── Download app banner ── */}
      <MarketingSection id="download-app" tint="muted">
        <div className="card-elevated overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex flex-col items-center gap-8 p-8 text-center sm:p-10 lg:flex-row lg:justify-between lg:text-left">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Download the {appConfig.name} app
              </h2>
              <p className="mt-3 text-slate-300">
                Book, track, and manage your laundry anytime, anywhere. Pay with GCash, card,
                wallet, or cash.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <AppStoreBadge store="android" />
                <AppStoreBadge store="ios" />
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Or{' '}
                <Link href="/signup" className="font-medium text-white underline-offset-2 hover:underline">
                  sign up on the web
                </Link>{' '}
                — same account everywhere
              </p>
            </div>

            <div className="hidden shrink-0 rounded-2xl bg-white p-4 lg:block">
              <QRCode
                value={ANDROID_PLAY_STORE_URL}
                size={132}
                aria-label="QR code linking to the Google Play download page"
              />
              <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                Scan to download
              </p>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* ── FAQ ── */}
      <MarketingSection id="faq">
        <MarketingSectionHeader
          title="Frequently asked questions"
          description="Quick answers about booking, tracking, and delivery."
        />

        <div className="faq-list mx-auto mt-10 max-w-3xl">
          {HOME_FAQS.map((item) => (
            <details key={item.id} className="faq-item group">
              <summary className="faq-question">
                <span>{item.question}</span>
                <FaqChevron />
              </summary>
              <div className="faq-answer-wrap">
                <p className="faq-answer">{item.answer}</p>
              </div>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Have another question?{' '}
          <Link href="/faq" className="link-primary">
            Browse the full FAQ
          </Link>
        </p>
      </MarketingSection>

      {/* ── Join strip ── */}
      <MarketingSection tint="bordered" className="pb-20 sm:pb-24">
        <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Work with {appConfig.name}
            </h2>
            <p className="mt-1.5 text-muted">
              Partner your laundry shop or earn on your schedule as a rider.
            </p>
          </div>
          <MarketingActions className="w-full sm:w-auto" align="end">
            <ButtonLink href="/partners" size="lg" layout="responsive">
              Partner with us
            </ButtonLink>
            <ButtonLink href="/riders" variant="outline" size="lg" layout="responsive">
              Drive with {appConfig.name}
            </ButtonLink>
          </MarketingActions>
        </div>
      </MarketingSection>
    </MarketingShell>
  );
}
