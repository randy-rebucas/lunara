'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../components/customer-nav';
import { DataPageStatus } from '../../components/data-page-status';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  updatedAt?: string;
}

export default function RefundsListPage() {
  const { api } = useAuthContext();

  const load = useCallback(async () => {
    const res = await api.get<RefundRow[]>('/refunds');
    return res.data;
  }, [api]);

  const { data: items, loading, error } = useCustomerQuery(load, [api]);

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold">Refund requests</h1>
        <p className="mt-1 text-sm text-slate-500">Track status from submission through payout.</p>

        <div className="mt-4">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading refunds…" />
        </div>

        <div className="mt-6 space-y-2">
          {(items ?? []).map((r) => (
            <Link
              key={r._id}
              href={`/refunds/${r._id}`}
              className="block rounded-xl border bg-white p-4 hover:border-primary"
            >
              <p className="font-medium">Order …{r.orderId.slice(-6)}</p>
              <p className="text-sm capitalize text-slate-500">
                {formatRefundStatus(r.status)} · ₱{r.requestedAmount}
              </p>
            </Link>
          ))}
          {!loading && !error && (items ?? []).length === 0 && (
            <p className="text-slate-500">No refund requests yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
