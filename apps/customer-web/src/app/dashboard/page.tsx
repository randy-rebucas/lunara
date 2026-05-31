'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { ButtonLink } from '../../components/ui/button-link';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { formatCurrency } from '@lunara/utils';
import { DataPageStatus } from '../../components/data-page-status';
import { PageShell } from '../../components/page-shell';
import { ReviewNotifications } from '../../components/review/review-notifications';
import { DashboardDeals, ShareInviteCard } from '../../components/share/share-sections';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface CustomerProfile {
  firstName: string;
  lastName: string;
}

interface OrderSummary {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading, api } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchOnboardingStatus(api).then((status) => {
      if (!status.isComplete) {
        router.replace(status.needsProfile ? '/onboarding/profile' : '/onboarding/address');
      }
    });
  }, [isAuthenticated, api, router]);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
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
      orders: ordersRes.data.items.slice(0, 3),
    };
  }, [isAuthenticated, api]);

  const { data, loading, error } = useCustomerQuery(load, [isAuthenticated, api]);

  if (isLoading || !isAuthenticated) return null;

  const profile = data?.profile ?? null;
  const balance = data?.balance ?? 0;
  const orders = data?.orders ?? [];
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

      <DashboardDeals />

      <ShareInviteCard />

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent orders</h2>
          <Link href="/orders" className="text-sm link-primary">
            View all →
          </Link>
        </div>
        <div className="list-stack">
          {!loading && !error && orders.length === 0 ? (
            <Card>
              <CardBody className="text-center text-muted">
                No orders yet.{' '}
                <Link href="/book" className="link-primary">
                  Book your first load
                </Link>
              </CardBody>
            </Card>
          ) : (
            orders.map((o) => (
              <Link key={o._id} href={`/orders/${o._id}`}>
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody className="flex items-center justify-between gap-4 py-4">
                    <span className="font-medium capitalize text-slate-900">
                      {o.bookingType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-muted">
                      {formatCurrency(o.total)} · {o.status.replace(/_/g, ' ')}
                    </span>
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
