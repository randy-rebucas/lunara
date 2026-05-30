'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { Button } from '@lunara/ui';
import { fetchOnboardingStatus } from '@lunara/hooks/onboarding';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { formatCurrency } from '@lunara/utils';
import { CustomerNav } from '../../components/customer-nav';
import { DataPageStatus } from '../../components/data-page-status';
import { ReviewNotifications } from '../../components/review/review-notifications';
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
    <>
      <CustomerNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold">Welcome, {name}</h1>
        <p className="mt-1 text-slate-600">Your laundry hub — book, track, and pay in one place.</p>

        <div className="mt-4">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-slate-500">Wallet balance</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(balance)}</p>
            <Link href="/wallet" className="mt-3 inline-block text-sm text-primary">
              Manage wallet →
            </Link>
          </div>
          <div className="rounded-xl border bg-white p-5 sm:col-span-2">
            <p className="text-sm text-slate-500">Ready to schedule pickup?</p>
            <Link href="/book" className="mt-4 inline-block">
              <Button size="lg">Book laundry</Button>
            </Link>
          </div>
        </div>

        <ReviewNotifications />

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent orders</h2>
            <Link href="/orders" className="text-sm text-primary">
              My orders →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {!loading && !error && orders.length === 0 ? (
              <p className="rounded-lg border bg-white p-6 text-slate-500">
                No orders yet. Book your first load to get started.
              </p>
            ) : (
              orders.map((o) => (
                <Link
                  key={o._id}
                  href={`/orders/${o._id}`}
                  className="flex justify-between rounded-lg border bg-white p-4 hover:border-primary"
                >
                  <span className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</span>
                  <span className="text-slate-600">
                    {formatCurrency(o.total)} · {o.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
