'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import {
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
} from './marketing-design';
import { MarketingShell } from './marketing-shell';
import { Reveal } from './reveal';
import { useHeroParallax } from './use-hero-parallax';
import {
  PhoneFrame,
  ScreenBooking,
  ScreenHome,
  ScreenNotifications,
  ScreenRewards,
  ScreenTracking,
} from './phone-mockup';
import {
  EXPANDING_AREAS,
  FEATURES,
  HOME_FAQS,
  HOW_IT_WORKS,
  PRICING_TIERS,
  SERVICE_AREAS,
  STATS,
  TRUST_CHIPS,
  fetchActiveServiceAreas,
  fetchFeaturedReviews,
  groupServiceAreasByPartner,
  type CustomerReview,
  type ServiceArea,
} from './home-page-data';

/** Cycles the three committed enamel colors across a list — the route line's palette. */
const ROUTE_COLORS = ['red', 'yellow', 'blue'] as const;
type RouteColor = (typeof ROUTE_COLORS)[number];

function routeColorAt(index: number): RouteColor {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

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

/** Small soap-bubble accent kept for the (old-world) download banner only — the hero and
 * route sections below have moved on to the signage world and no longer use these. */
function Bubbles({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <span className="bubble left-[8%] top-[20%] h-10 w-10 sm:h-14 sm:w-14" />
      <span className="bubble right-[10%] top-[10%] h-7 w-7 sm:h-9 sm:w-9" />
      <span className="bubble right-[22%] bottom-[15%] hidden h-16 w-16 sm:block" />
      <span className="bubble left-[30%] bottom-[8%] h-5 w-5 sm:h-6 sm:w-6" />
    </div>
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

/**
 * The route line's signature moment: a single SVG path that "paints itself on" once it
 * scrolls into view, via a stroke-dashoffset transition. No-ops (drawn immediately) under
 * prefers-reduced-motion — handled entirely in CSS (.route-path / .route-path-drawn).
 */
function RoutePath({
  d,
  viewBox,
  className,
  strokeWidth = 4,
}: {
  d: string;
  viewBox: string;
  className?: string;
  strokeWidth?: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = pathRef.current;
    if (!node) return;
    const length = node.getTotalLength();
    node.style.setProperty('--route-len', `${Math.ceil(length)}`);

    if (typeof IntersectionObserver === 'undefined') {
      setDrawn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <svg viewBox={viewBox} className={className} preserveAspectRatio="none" aria-hidden>
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="var(--color-route-ink)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="10 8"
        className={cn('route-path', drawn && 'route-path-drawn')}
      />
    </svg>
  );
}

const routeAccentText: Record<RouteColor, string> = {
  red: 'text-route-red',
  yellow: 'text-route-yellow',
  blue: 'text-route-blue',
};

export function HomePage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([...SERVICE_AREAS]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);

  const phoneLeftRef = useRef<HTMLDivElement>(null);
  const phoneRightRef = useRef<HTMLDivElement>(null);
  const featuresBgRef = useRef<HTMLDivElement>(null);
  useHeroParallax([
    { ref: phoneLeftRef, speed: 0.05 },
    { ref: phoneRightRef, speed: 0.09 },
    { ref: featuresBgRef, speed: 0.15 },
  ]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      router.replace(getOnboardingPath(status));
    });
  }, [isLoading, isAuthenticated, api, router]);

  useEffect(() => {
    const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
    fetchActiveServiceAreas(apiBase).then(setServiceAreas);
    fetchFeaturedReviews(apiBase).then(setCustomerReviews);
  }, []);

  // Render marketing content during the auth check so crawlers and first paint
  // get the real page; only swap to the loader once we know we're redirecting.
  if (isAuthenticated) return <AuthLoading message="Redirecting…" />;

  const heroStops = [
    { label: 'Pickup', detail: 'Rider collects at your door', color: 'red' as const },
    { label: 'Wash Partner', detail: 'Verified shop washes & folds', color: 'yellow' as const },
    { label: 'Delivery', detail: 'Fresh laundry, back home', color: 'blue' as const },
  ];

  return (
    <MarketingShell>
      {/* ── Hero: the route board ── */}
      <section className="route-ground relative overflow-hidden border-b-4 border-route-ink">
        <div className="marketing-container relative pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-20">
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
            <div className="max-w-xl">
              <Reveal>
                <div className="route-board px-6 py-8 sm:px-8 sm:py-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-route-yellow">
                    Philippines · Door-to-door laundry
                  </p>
                  <h1 className="signage-heading mt-3 text-5xl text-white sm:text-6xl lg:text-[4.25rem]">
                    Your laundry
                    <br />
                    has a route.
                  </h1>
                  <p className="mt-5 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
                    Book pickup in seconds, watch it move stop by stop, and get it delivered back
                    fresh — run by a real network of shops and riders, not one storefront.
                  </p>

                  <MarketingActions className="mt-8" gap="loose">
                    <ButtonLink href="/signup" size="lg" layout="responsive" className="ticket-btn">
                      Board this route
                    </ButtonLink>
                    <ButtonLink
                      href="/how-it-works"
                      variant="outline"
                      size="lg"
                      layout="responsive"
                      className="border-2 border-white/70 bg-transparent text-white hover:bg-white/10"
                    >
                      See how it runs
                    </ButtonLink>
                  </MarketingActions>
                </div>
              </Reveal>

              {/* Trust chips — restyled as small placard chips, not soft tint pills */}
              <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TRUST_CHIPS.map((chip, index) => (
                  <Reveal
                    as="div"
                    key={chip.title}
                    delay={100 + index * 60}
                    className="flex flex-col items-start gap-2 rounded-md border-2 border-route-ink/15 bg-white p-3"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md border-2 border-route-ink',
                        index % 3 === 0 && 'bg-route-red text-white',
                        index % 3 === 1 && 'bg-route-yellow text-route-ink',
                        index % 3 === 2 && 'bg-route-blue text-white',
                      )}
                    >
                      <chip.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <dt className="text-xs font-bold text-slate-900">{chip.title}</dt>
                      <dd className="text-[11px] text-muted">{chip.subtitle}</dd>
                    </div>
                  </Reveal>
                ))}
              </dl>
            </div>

            {/* Route stops + phone trio */}
            <div className="relative">
              <ol className="relative flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-3">
                <RoutePath
                  d="M8 20 H 92"
                  viewBox="0 0 100 40"
                  className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-6 w-full -translate-y-1/2 sm:block"
                  strokeWidth={2}
                />
                {heroStops.map((stop, index) => (
                  <Reveal
                    as="li"
                    key={stop.label}
                    delay={index * 90}
                    className={cn('placard flex-1', `placard-${stop.color}`)}
                  >
                    <span className="route-stop-number">{index + 1}</span>
                    <div>
                      <p className="signage-heading text-xl">{stop.label}</p>
                      <p className="mt-1 text-xs leading-snug opacity-90">{stop.detail}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>

              <div className="relative mx-auto mt-8 flex items-center justify-center">
                <div ref={phoneLeftRef} className="parallax-layer">
                  <PhoneFrame className="z-0 hidden -rotate-6 sm:block sm:-mr-10 sm:w-44">
                    <ScreenHome />
                  </PhoneFrame>
                </div>
                <PhoneFrame className="z-10 w-52 sm:w-56">
                  <ScreenBooking />
                </PhoneFrame>
                <div ref={phoneRightRef} className="parallax-layer">
                  <PhoneFrame className="z-0 hidden rotate-6 sm:block sm:-ml-10 sm:w-44">
                    <ScreenTracking />
                  </PhoneFrame>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Founding partners strip ── */}
      <section aria-label="Founding partners" className="border-b border-border/40 bg-surface">
        <Reveal as="div" className="marketing-container py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Trusted by our founding partners
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {groupServiceAreasByPartner(serviceAreas)
              .filter((partner) => partner.logoUrl)
              .slice(0, 4)
              .map((partner) => (
                <li key={partner.partnerId}>
                  <Link
                    href={`/service-areas/${partner.branches[0].id}`}
                    className="flex h-16 w-32 items-center justify-center rounded-xl border border-border/60 bg-white p-2"
                    aria-label={partner.partnerName}
                    title={partner.partnerName}
                  >
                    <Image
                      src={partner.logoUrl!}
                      alt={partner.partnerName}
                      width={128}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </Link>
                </li>
              ))}
            <li className="flex items-center gap-2 text-sm font-medium text-muted">
              <Store className="h-4 w-4 text-primary" aria-hidden />
              More partner laundries coming soon
            </li>
          </ul>
        </Reveal>
      </section>

      {/* ── Features: route capabilities ── */}
      <MarketingSection id="features" className="relative overflow-hidden">
        <div
          ref={featuresBgRef}
          className="parallax-layer pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[calc(100%+12rem)]"
          aria-hidden
        >
          <Image
            src="/images/background.png"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-white/90" />
        </div>

        <MarketingSectionHeader
          title="Everything the route covers"
          description="Built for busy households and professionals who want laundry off their to-do list."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const color = routeColorAt(index);
            return (
              <Reveal
                as="article"
                key={feature.title}
                delay={(index % 3) * 60}
                className="card flex h-full flex-col p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
              >
                <span className={cn('icon-placard', `icon-placard-${color}`)}>
                  <feature.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.description}</p>
              </Reveal>
            );
          })}
        </div>
      </MarketingSection>

      {/* ── How it works: destination placards along the route ── */}
      <MarketingSection id="how-it-works" className="route-ground">
        <MarketingSectionHeader
          title={`How ${appConfig.name} runs the route`}
          description="Four stops from dirty laundry to fresh and delivered."
        />

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <RoutePath
            d="M12 12 H 88"
            viewBox="0 0 100 24"
            className="pointer-events-none absolute inset-x-0 top-8 hidden h-6 w-full lg:block"
            strokeWidth={2}
          />
          {HOW_IT_WORKS.map((item, index) => {
            const color = routeColorAt(index);
            return (
              <Reveal
                as="li"
                key={item.step}
                delay={index * 80}
                className={cn('placard items-center text-center', `placard-${color}`)}
              >
                <span className="route-stop-number mx-auto">{item.step}</span>
                <span className="icon-placard mx-auto border-white/70 bg-white/15">
                  <item.icon className="h-6 w-6" aria-hidden />
                </span>
                <p className="signage-heading text-lg">{item.title}</p>
                <p className="text-xs leading-relaxed opacity-90">{item.description}</p>
              </Reveal>
            );
          })}
        </ol>
      </MarketingSection>

      {/* ── App showcase ── */}
      <MarketingSection>
        <Reveal as="div" className="grid items-center gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12">
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
        </Reveal>
      </MarketingSection>

      {/* ── Live tracking, staged as a route-board update (not a live-map pin) ── */}
      <MarketingSection tint="muted">
        <div className="mx-auto max-w-2xl">
          <Reveal as="div" className="route-board flex flex-col p-8 sm:p-10">
            <div>
              <span className="route-status-plate">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
                Now at: Wash Partner
              </span>
              <h2 className="signage-heading mt-4 text-3xl text-white sm:text-4xl">
                Real-time tracking
              </h2>
              <p className="mt-3 text-white/70">
                Every stop on the route, updated live — no guessing where your order is.
              </p>
            </div>

            {/* Route recap for this order */}
            <ol className="relative mt-8 flex items-center gap-2">
              {(['red', 'yellow', 'blue'] as const).map((color, index) => (
                <li key={color} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      'route-stop-number shrink-0',
                      index < 2 && 'opacity-100',
                      index === 1 && 'ring-2 ring-white',
                    )}
                  >
                    {index + 1}
                  </span>
                  {index < 2 ? <span className="h-0.5 flex-1 bg-white/30" aria-hidden /> : null}
                </li>
              ))}
            </ol>

            {/* Rider card */}
            <div className="relative mt-6 max-w-sm rounded-md border-2 border-route-ink bg-white p-5 text-slate-900">
              <div className="flex items-center gap-3">
                <span className="icon-placard icon-placard-blue text-sm font-bold">JD</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Rider assigned</p>
                  <p className="truncate font-semibold">John D.</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-route-ink bg-route-yellow text-route-ink">
                  <Phone className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-surface-muted p-3">
                  <dt className="text-xs text-muted">ETA</dt>
                  <dd className="mt-0.5 font-semibold">12 mins</dd>
                </div>
                <div className="rounded-md bg-surface-muted p-3">
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
          </Reveal>
        </div>
      </MarketingSection>

      {/* ── Reviews + stats: passenger testimonials ── */}
      <MarketingSection id="reviews">
        <MarketingSectionHeader
          title="What passengers say"
          description={`Real reviews from customers who've ridden the ${appConfig.name} route.`}
        />

        {customerReviews.length > 0 && (
          <Reveal as="div" className="mt-12">
            <Carousel
              items={customerReviews}
              getKey={(review) => review.id}
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
                        <p className="text-xs text-muted">Verified customer</p>
                      </div>
                    </footer>
                  </div>
                </blockquote>
              )}
            />
          </Reveal>
        )}

        <dl className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat, index) => {
            const color = routeColorAt(index);
            return (
              <Reveal as="div" key={stat.label} delay={index * 70} className="flex flex-col items-center text-center">
                <span className={cn('icon-placard h-12 w-12', `icon-placard-${color}`)}>
                  <stat.icon className="h-6 w-6" aria-hidden />
                </span>
                <dt className="order-2 mt-2 text-xs font-medium uppercase tracking-wide text-muted">
                  {stat.label}
                </dt>
                <dd className={cn('order-1 mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl', routeAccentText[color])}>
                  {stat.value}
                </dd>
              </Reveal>
            );
          })}
        </dl>
      </MarketingSection>

      {/* ── Service areas: the route map ── */}
      <MarketingSection id="service-areas" className="route-ground">
        <MarketingSectionHeader
          title="Where the route runs"
          description="Live pickup and delivery across Metro Manila. Enter your address when booking to confirm coverage."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {serviceAreas.slice(0, 3).map((branch, index) => {
            const color = routeColorAt(index);
            return (
              <Reveal
                as={Link}
                key={branch.id}
                delay={index * 70}
                href={`/service-areas/${branch.id}`}
                className="card flex h-full flex-col p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
              >
                <span className={cn('icon-placard', `icon-placard-${color}`)}>
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{branch.name}</h3>
                <p className="mt-0.5 text-sm font-medium text-primary">{branch.city}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{branch.area}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  ~{branch.radiusKm} km service radius
                </p>
              </Reveal>
            );
          })}
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

      {/* ── Pricing: the fare board ── */}
      <MarketingSection id="pricing">
        <MarketingSectionHeader
          title="The fare board"
          description="Know what you'll pay before you confirm. No hidden fees."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier, index) => {
            const color = routeColorAt(index);
            return (
              <Reveal
                as="div"
                key={tier.service}
                delay={index * 70}
                className="card-elevated flex h-full flex-col p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated-lg)] sm:p-8"
              >
                <div className="flex items-start justify-between">
                  <span className={cn('icon-placard', `icon-placard-${color}`)}>
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
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Final prices confirmed at checkout based on actual weight and service selection.
        </p>
      </MarketingSection>

      {/* ── Download app banner: board this route ── */}
      <MarketingSection id="download-app" tint="muted">
        <Reveal as="div" className="card-elevated relative overflow-hidden bg-slate-900">
          <Image
            src="https://images.unsplash.com/photo-1598769398698-bab7f1b4cadd?fm=jpg&q=80&w=1600&auto=format&fit=crop"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-40"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900/70"
            aria-hidden
          />
          <Bubbles />
          <div className="relative flex flex-col items-center gap-8 p-8 text-center sm:p-10 lg:flex-row lg:justify-between lg:text-left">
            <div className="max-w-xl">
              <h2 className="signage-heading text-3xl text-white sm:text-4xl">
                Board the {appConfig.name} route
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
        </Reveal>
      </MarketingSection>

      {/* ── FAQ ── */}
      <MarketingSection id="faq">
        <MarketingSectionHeader
          title="Frequently asked questions"
          description="Quick answers about booking, tracking, and delivery."
        />

        <div className="faq-list mx-auto mt-10 max-w-3xl">
          {HOME_FAQS.map((item, index) => (
            <Reveal as="details" key={item.id} delay={Math.min(index * 50, 250)} className="faq-item group">
              <summary className="faq-question">
                <span>{item.question}</span>
                <FaqChevron />
              </summary>
              <div className="faq-answer-wrap">
                <p className="faq-answer">{item.answer}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Have another question?{' '}
          <Link href="/faq" className="link-primary">
            Browse the full FAQ
          </Link>
        </p>
      </MarketingSection>

    </MarketingShell>
  );
}
