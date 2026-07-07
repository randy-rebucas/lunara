'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { ShoppingBag, X } from 'lucide-react';
import { cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';
import { fetchOnboardingStatus, getOnboardingPath } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { AuthLoading } from '../auth-loading';
import { ButtonLink } from '../ui/button-link';
import { Carousel } from '../ui/carousel';
import { MarketingActions } from './marketing-actions';
import { ParallaxBanner } from './parallax-banner';
import {
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingGradientText,
  MarketingHeroGlow,
  MarketingSection,
  MarketingSectionHeader,
  MarketingSectionIcon,
  accentClasses,
} from './marketing-design';
import { MarketingShell } from './marketing-shell';
import {
  CUSTOMER_REVIEWS,
  EXPANDING_AREAS,
  HERO_BANNER_IMAGE,
  HERO_IMAGE,
  HERO_STATS,
  HOW_IT_WORKS,
  PRICING_TIERS,
  SERVICE_AREAS,
  SOCIAL_PROOF,
  WHY_CHOOSE,
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

  if (isLoading) return <AuthLoading />;
  if (isAuthenticated) return <AuthLoading message="Redirecting…" />;

  return (
    <MarketingShell>
      {/* ── Hero ── */}
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

          {/* Hero card */}
          <div className="card-elevated relative mx-auto w-full max-w-md overflow-hidden lg:max-w-none">
            {/* Hero lifestyle image */}
            <div className="relative h-52 w-full sm:h-60">
              <Image
                src={HERO_IMAGE.src}
                alt={HERO_IMAGE.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface/60" aria-hidden />
            </div>
            <div className="card-body space-y-5 bg-gradient-to-br from-primary/5 via-surface to-secondary/5 sm:p-8">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" aria-hidden />
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Your next pickup
                </p>
              </div>

              <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">Wash &amp; Fold</span>
                  <span className="text-primary">~₱400</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Tomorrow · 8–10 AM</span>
                  <span className="badge-accent flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
                    Live tracking
                  </span>
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

      {/* ── Parallax banner ── */}
      <ParallaxBanner
        src={HERO_BANNER_IMAGE.src}
        alt={HERO_BANNER_IMAGE.alt}
        className="h-64 sm:h-80"
      >
        <div className="marketing-container flex h-64 flex-col items-center justify-center text-center sm:h-80">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Trusted laundry care
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold text-white sm:text-3xl">
            Professional-grade equipment, handled by vetted partners
          </h2>
        </div>
      </ParallaxBanner>

      {/* ── Social proof strip ── */}
      <section className="bg-slate-900" aria-label="Social proof">
        <div className="marketing-container py-8">
          <dl className="grid grid-cols-2 divide-y divide-white/10 md:grid-cols-4 md:divide-x md:divide-y-0">
            {SOCIAL_PROOF.map((item) => (
              <div key={item.label} className="px-2 py-4 text-center first:pt-0 md:py-0 md:first:pl-0">
                <dt className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {item.value}
                </dt>
                <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {item.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Download app ── */}
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

      {/* ── Book CTA ── */}
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

      {/* ── How it works ── */}
      <MarketingSection id="how-it-works" tint="muted">
        <MarketingSectionHeader
          title="How Lunara works"
          description="Four steps from dirty laundry to fresh and delivered."
        />

        <Carousel
          className="mx-auto mt-12 max-w-5xl"
          items={HOW_IT_WORKS}
          getKey={(item) => item.step}
          renderItem={(item) => {
            const Icon = item.icon;
            return (
              <div className="card h-full overflow-hidden">
                {/* Step image */}
                <div className="relative aspect-video w-full">
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 33vw"
                    className="object-cover grayscale transition duration-300 hover:grayscale-0"
                  />
                  {/* Step number badge overlaid on image */}
                  <span
                    className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-md"
                    aria-hidden
                  >
                    {item.step}
                  </span>
                </div>
                <div className="card-body flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          }}
        />
      </MarketingSection>

      {/* ── Service areas ── */}
      <MarketingSection id="service-areas">
        <MarketingSectionHeader
          title="Service areas"
          description="Live pickup and delivery across Metro Manila. Enter your address when booking to confirm coverage."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
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
                ~{branch.radiusKm} km service radius
              </p>
            </MarketingFeatureCard>
          ))}
        </div>

        <div className="card mt-8">
          <div className="card-body text-center sm:text-left">
            <MarketingSectionIcon
              icon={ShoppingBag}
              title="Expanding soon"
              className="justify-center sm:justify-start"
            />
            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {EXPANDING_AREAS.map((city) => (
                <li
                  key={city}
                  className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-[var(--shadow-card)] ring-1 ring-border/50"
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

      {/* ── Why choose Lunara ── */}
      <MarketingSection id="why-lunara" tint="muted">
        <MarketingSectionHeader
          title="Why choose Lunara"
          description="Built for busy households and professionals who want laundry off their to-do list."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CHOOSE.map((item) => {
            const Icon = item.icon;
            const accent = accentClasses(item.accent);
            return (
              <article
                key={item.title}
                className="card flex h-full flex-col hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="card-body flex flex-1 flex-col">
                  <div
                    className={cn(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',
                      accent.bg,
                    )}
                  >
                    <Icon className={cn('h-5 w-5', accent.text)} aria-hidden />
                  </div>
                  <span className={cn('w-fit', `badge-${item.accent}`)}>{item.label}</span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </MarketingSection>

      {/* ── Pricing teaser ── */}
      <MarketingSection id="pricing">
        <MarketingSectionHeader
          title="Simple, transparent pricing"
          description="Know what you'll pay before you confirm. No hidden fees."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.service}
              className="card-elevated flex h-full flex-col overflow-hidden hover:shadow-[var(--shadow-elevated-lg)]"
            >
              {/* Service image */}
              <div className="relative h-44 w-full">
                <Image
                  src={tier.image}
                  alt={tier.imageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover grayscale transition duration-300 hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface/50 to-transparent" aria-hidden />
              </div>
              <div className="card-body flex flex-1 flex-col">
                <span className={cn('w-fit', `badge-${tier.badgeVariant}`)}>{tier.badge}</span>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{tier.service}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">{tier.from}</span>
                  <span className="text-sm text-muted">{tier.unit}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {tier.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm text-muted">
                      <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink href="/signup" size="sm" layout="responsive">
                    Book now
                  </ButtonLink>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Final prices confirmed at checkout based on actual weight and service selection.
        </p>
      </MarketingSection>

      {/* ── Customer reviews ── */}
      <MarketingSection id="reviews" tint="muted">
        <MarketingSectionHeader
          title="Customer reviews"
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
      </MarketingSection>

      {/* ── Partner & Rider CTA ── */}
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
              <ButtonLink href="/partners/apply" variant="outline" size="lg" layout="responsive">
                Apply now
              </ButtonLink>
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
              <ButtonLink href="/riders/apply" variant="outline" size="lg" layout="responsive">
                Apply to drive
              </ButtonLink>
            </MarketingActions>
          </MarketingCtaPanel>
        </div>
      </MarketingSection>
    </MarketingShell>
  );
}
