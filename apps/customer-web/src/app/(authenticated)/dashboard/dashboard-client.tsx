'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Wallet, Shirt, Receipt, Gift, LifeBuoy, ChevronRight } from 'lucide-react';
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
import { DealsCarousel } from '../../../components/deals/deals-carousel';
import { BannerStrip } from '../../../components/marketing/banner-strip';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { ButtonLink } from '../../../components/ui/button-link';
import { Card, CardBody } from '../../../components/ui/card';
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

  const { data, loading, error } = useCustomerQuery(load, [ready, api]);

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
    <PageShell>
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Welcome back</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
        </div>
        <Link
          href="/wallet"
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 py-1.5 pl-1.5 pr-3.5 text-sm font-semibold text-primary"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
          </span>
          {formatCurrency(balance)}
        </Link>
      </header>

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />

      <Card
        elevated
        className="overflow-hidden border-0 bg-gradient-to-br from-primary to-blue-500 text-white"
      >
        <CardBody className="flex items-center justify-between gap-4 py-5">
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

      <DealsCarousel />

      <ShareInviteCard />

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
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-slate-900">
                            {o.bookingType.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-primary">{currentStepLabel}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {formatOrderStatusLabel(o.status)}
                          </p>
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
    </PageShell>
  );
}
