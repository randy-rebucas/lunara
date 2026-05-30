'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { OrderStatus } from '@lunara/types';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  buildCustomerTimeline,
  formatCurrency,
  formatOrderStatusLabel,
} from '@lunara/utils';
import { CustomerNav } from '../../components/customer-nav';
import { DataPageStatus } from '../../components/data-page-status';
import { useRequireOnboardingComplete } from '../../hooks/use-require-onboarding';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface OrderSummary {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  createdAt?: string;
}

export default function OrdersPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useRequireOnboardingComplete();

  const load = useCallback(async () => {
    if (!ready) return [] as OrderSummary[];
    const res = await api.get<{ items: OrderSummary[] }>('/orders');
    return res.data.items;
  }, [ready, api]);

  const { data: orders, loading, error } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) return null;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">My orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select an order to view the full timeline and live status updates
        </p>

        <div className="mt-4">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />
        </div>

        <div className="mt-6 space-y-4">
          {!loading && !error && (orders ?? []).length === 0 ? (
            <p className="rounded-lg border bg-white p-6 text-slate-500">
              No orders yet.{' '}
              <Link href="/book" className="text-primary">
                Book laundry
              </Link>
            </p>
          ) : (
            (orders ?? []).map((o) => {
              const { progressPercent, currentStepLabel } = buildCustomerTimeline(o.status);
              return (
                <Link
                  key={o._id}
                  href={
                    o.status === OrderStatus.PENDING
                      ? `/checkout/${o._id}`
                      : `/orders/${o._id}`
                  }
                  className="block rounded-lg border bg-white p-4 transition hover:border-primary hover:shadow-sm"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-sm text-primary">{currentStepLabel}</p>
                      <p className="mt-0.5 text-xs capitalize text-slate-500">
                        {formatOrderStatusLabel(o.status)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(o.total)}</p>
                      {o.status === OrderStatus.PENDING ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">Pay →</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Track →</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
