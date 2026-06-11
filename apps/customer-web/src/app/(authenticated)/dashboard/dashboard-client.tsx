'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { OrderStatus } from '@lunara/types';
import { formatCurrency, isActiveOrderStatus, type PartnerCoverageInfo } from '@lunara/utils';
import { OrderPartnerCoverageNotice } from '../../../components/order-partner-coverage-notice';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { ReviewNotifications } from '../../../components/review/review-notifications';
import { DealsCarousel } from '../../../components/deals/deals-carousel';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { ButtonLink } from '../../../components/ui/button-link';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

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
      api.get<{ items: OrderSummary[] }>('/orders'),
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
  const name = profile ? `${profile.firstName} ${profile.lastName}` : 'there';

  return (
    <PageShell>
      <PageHeader
        title={`Welcome, ${name}`}
        description="Your laundry hub — book, track, and pay in one place."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-muted">Wallet balance</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-primary">{formatCurrency(balance)}</p>
            <Link href="/wallet" className="mt-4 inline-flex text-sm link-primary">
              Manage wallet →
            </Link>
          </CardBody>
        </Card>
        <Card className="sm:col-span-2">
          <CardBody className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-muted">Ready to schedule pickup?</p>
              <p className="mt-1 text-sm text-muted-foreground">Book wash, dry clean, or express service</p>
            </div>
            <ButtonLink href="/book" size="lg" className="shrink-0 px-6">
              Book laundry
            </ButtonLink>
          </CardBody>
        </Card>
      </div>

      <ReviewNotifications />

      <DealsCarousel />

      <ShareInviteCard />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {activeOrders.length > 0 ? 'Active orders' : 'Recent orders'}
          </h2>
          <Link href="/orders" className="text-sm link-primary">
            View all →
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
            displayOrders.map((o) => (
              <Link
                key={o._id}
                href={
                  o.status === OrderStatus.PENDING ? `/checkout/${o._id}` : `/orders/${o._id}`
                }
              >
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium capitalize text-slate-900">
                        {o.bookingType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-muted">
                        {formatCurrency(o.total)} · {o.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {o.status === OrderStatus.PENDING_DISPATCH && (
                      <OrderPartnerCoverageNotice coverage={o.partnerCoverage} />
                    )}
                  </CardBody>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}
