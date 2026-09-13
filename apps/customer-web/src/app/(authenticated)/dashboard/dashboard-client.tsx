'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { Wallet, Shirt, Receipt, Gift, LifeBuoy, ChevronRight, WashingMachine } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { OrderStatus } from '@lunara/types';
import {
  buildCustomerTimeline,
  formatCurrency,
  formatOrderStatusLabel,
  isActiveOrderStatus,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { OrderPartnerCoverageNotice } from '../../../components/order-partner-coverage-notice';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { ReviewNotifications } from '../../../components/review/review-notifications';
import { BannerStrip } from '../../../components/marketing/banner-strip';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { ButtonLink } from '../../../components/ui/button-link';
import { Card, CardBody } from '../../../components/ui/card';
import { useDebouncedCallback } from '../../../hooks/use-debounced-callback';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

const quickActions = [
  { href: '/book', label: 'Book laundry', icon: Shirt },
  { href: '/orders', label: 'Orders', icon: Receipt },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/support', label: 'Support', icon: LifeBuoy },
];

interface CustomerProfile {
  firstName: string;
  lastName: string;
  loyaltyPoints?: number;
}

interface OrderSummary {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  partnerCoverage?: PartnerCoverageInfo;
}

export function DashboardClient() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  const load = useCallback(async () => {
    if (!ready) {
      return { profile: null as CustomerProfile | null, balance: 0, orders: [] as OrderSummary[] };
    }
    const [profileRes, walletRes, ordersRes] = await Promise.all([
      api.get<CustomerProfile>('/customers/me'),
      api.get<{ balance: number }>('/wallets/me'),
      api.get<{ items: OrderSummary[] }>('/orders?limit=10'),
    ]);
    return {
      profile: profileRes.data,
      balance: walletRes.data.balance,
      orders: ordersRes.data.items,
    };
  }, [ready, api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  // CustomerTrackingSync (mounted globally) fires this on every 'orderStatusUpdate'/'orderEvent'
  // it receives over the /tracking socket — without this listener, a customer sitting on the
  // dashboard while their order is picked up, delivered, has its total adjusted, etc. would only
  // see the notification bell update; the active-orders card and wallet balance here would stay
  // stale until they navigated away and back. Debounced since a single status change can emit
  // more than one event in quick succession.
  const scheduleReload = useDebouncedCallback(() => {
    reload().catch(() => {});
  }, 500);

  useEffect(() => {
    window.addEventListener('lunara-notifications-bump', scheduleReload);
    return () => window.removeEventListener('lunara-notifications-bump', scheduleReload);
  }, [scheduleReload]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading dashboard…" />;
  }

  const profile = data?.profile ?? null;
  const balance = data?.balance ?? 0;
  const allOrders = data?.orders ?? [];
  const activeOrders = allOrders.filter((o) => isActiveOrderStatus(o.status));
  const displayOrders = (activeOrders.length > 0 ? activeOrders : allOrders).slice(0, 3);
  const name = profile ? profile.firstName : 'there';

  return (
    <PageShell className="lg:max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
        </div>
        <Link
          href="/wallet"
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold text-primary lg:hidden"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
          </span>
          {formatCurrency(balance)}
        </Link>
      </header>

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-8">
        <div className="min-w-0 lg:col-span-2">
          <Card
            elevated
            className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-blue-500 text-white"
          >
            <Image
              src="/images/dashboard/hero-towels.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="pointer-events-none absolute inset-0 object-cover object-right opacity-90 mix-blend-luminosity"
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-transparent" aria-hidden />
            <CardBody className="relative flex items-center justify-between gap-4 py-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/85">Ready to schedule pickup?</p>
                <p className="mt-1 text-lg font-semibold leading-snug">Wash, dry clean, or express</p>
              </div>
              <ButtonLink
                href="/book"
                size="lg"
                className="shrink-0 border-0 bg-white px-5 text-slate-900 hover:bg-white/90"
              >
                Book now
              </ButtonLink>
            </CardBody>
          </Card>

          <nav aria-label="Quick actions" className="mt-5 -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex w-20 shrink-0 flex-col items-center gap-2 rounded-xl py-2 text-center sm:w-auto"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <span className="text-xs font-medium leading-tight text-slate-700">{action.label}</span>
                </Link>
              );
            })}
          </nav>

          <ReviewNotifications />

          <div className="mt-6">
            <BannerStrip />
          </div>

          <ShareInviteCard className="mt-10 lg:hidden" />

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                {activeOrders.length > 0 ? 'Active orders' : 'Recent orders'}
              </h2>
              <Link href="/orders" className="text-sm link-primary">
                View all
              </Link>
            </div>
            <div className="list-stack">
              {!loading && !error && displayOrders.length === 0 ? (
                <Card>
                  <CardBody className="text-center text-muted">
                    No orders yet.{' '}
                    <Link href="/book" className="link-primary">
                      Book your first load
                    </Link>
                  </CardBody>
                </Card>
              ) : (
                displayOrders.map((o) => {
                  const { progressPercent, currentStepLabel } = buildCustomerTimeline(o.status);
                  const isPending = o.status === OrderStatus.PENDING;
                  return (
                    <Link
                      key={o._id}
                      href={isPending ? `/checkout/${o._id}` : `/orders/${o._id}`}
                    >
                      <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)] active:shadow-none">
                        <CardBody className="py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Image
                                src="/images/dashboard/order-thumb-default.png"
                                alt={`${o.bookingType.replace(/_/g, ' ')} order`}
                                width={56}
                                height={56}
                                className="h-14 w-14 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0">
                                <p className="font-medium capitalize text-slate-900">
                                  {o.bookingType.replace(/_/g, ' ')}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-primary">{currentStepLabel}</p>
                                <p className="text-xs capitalize text-muted-foreground">
                                  {formatOrderStatusLabel(o.status)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <p className="font-semibold text-slate-900">{formatCurrency(o.total)}</p>
                              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                            </div>
                          </div>
                          {o.status === OrderStatus.PENDING_DISPATCH && (
                            <OrderPartnerCoverageNotice coverage={o.partnerCoverage} />
                          )}
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </CardBody>
                      </Card>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="mt-8 hidden min-w-0 flex-col gap-4 lg:mt-0 lg:flex">
          <Link href="/wallet" className="block">
            <Card elevated className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm text-muted">Wallet balance</p>
                    <p className="text-xl font-bold tracking-tight text-slate-900">{formatCurrency(balance)}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </CardBody>
            </Card>
          </Link>

          <Card elevated className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-blue-600 text-white">
            <Image
              src="/images/dashboard/offer-towels.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 24rem, 100vw"
              className="pointer-events-none absolute inset-0 object-cover object-right opacity-80 mix-blend-luminosity"
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/75 to-primary/10" aria-hidden />
            <CardBody className="relative">
              <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
                Special offer
              </span>
              <p className="mt-3 text-xl font-bold leading-tight">Clean clothes, happier days</p>
              <p className="mt-2 text-sm text-white/85">Same great care.</p>
              <p className="font-[family-name:var(--font-script)] text-2xl leading-none text-white">
                More time for what matters.
              </p>
              <ButtonLink
                href="/book"
                size="sm"
                variant="outline"
                className="mt-4 border-white/60 bg-transparent text-white hover:bg-white/10"
              >
                Book a pickup
              </ButtonLink>
            </CardBody>
          </Card>

          <ShareInviteCard className="" />

          <Link href="/rewards" className="block">
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                  <Gift className="h-5 w-5 text-secondary" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">Earn rewards</p>
                  <p className="text-sm text-muted">Get perks and discounts for every order.</p>
                </div>
              </CardBody>
            </Card>
          </Link>

          <Link href="/support" className="block">
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <LifeBuoy className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">Need help?</p>
                  <p className="text-sm text-muted">Our support team is here for you.</p>
                </div>
              </CardBody>
            </Card>
          </Link>

          <Card elevated className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-surface to-secondary/10">
            <CardBody className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Get the {appConfig.name} app
                </p>
                <p className="mt-1 text-lg font-bold leading-snug text-slate-900">Laundry on the go</p>
                <p className="mt-1 text-sm text-muted">
                  Book, track, and manage your orders anytime, anywhere.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="https://play.google.com/store/apps/details?id=com.lunara.customer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M3.18 23.76a2 2 0 0 0 2.85-.06l.06-.07 9.74-9.73-2.6-2.6L3.18 23.76zM20.47 10.7l-2.5-1.44-2.91 2.91 2.91 2.9 2.52-1.45a1.43 1.43 0 0 0 0-2.92zM2 2.45A1.42 1.42 0 0 0 1.5 3.5v17a1.42 1.42 0 0 0 .5 1.06l.07.06 9.56-9.56v-.22L2.07 2.38 2 2.45zm10.27 10.6L3.18.24A2 2 0 0 0 .33.18L13.23 13.05l-1-2z" />
                    </svg>
                    Get it on Google Play
                  </a>
                  <span
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500"
                    title="iOS app coming soon"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.2-.11 1.62-.98 3.41-.84 1.23.1 2.35.66 3.16 1.73-2.75 1.65-2.29 5.42.41 6.51-.55 1.42-1.25 2.83-2.06 4.77zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.31-2.1 4.03-3.74 4.25z" />
                    </svg>
                    App Store — coming soon
                  </span>
                </div>
              </div>
              <span className="hidden shrink-0 h-20 w-11 items-center justify-center rounded-[0.9rem] bg-slate-900 p-1 shadow-[0_16px_32px_-12px_rgb(15_23_42/0.4)] sm:flex">
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[0.6rem] bg-primary text-white">
                  <WashingMachine className="h-4 w-4" aria-hidden />
                  <span className="text-[6px] font-bold leading-none">{appConfig.name}</span>
                </span>
              </span>
            </CardBody>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
