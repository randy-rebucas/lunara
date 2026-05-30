'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { DataPageStatus } from '../../components/data-page-status';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  requestedAmount: number;
  reason: string;
  bookingType?: string;
  orderStatus?: string;
}

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : '';
    return adminFetch<{ items: RefundRow[] }>(`/admin/refunds${q}`);
  }, [filter]);

  const { data, loading, error } = useAdminQuery(load, [filter]);
  const items = data?.items ?? [];

  return (
    <div>
      <h2 className="text-2xl font-bold">Refund requests</h2>
      <p className="mt-1 text-sm text-slate-500">
        Review → verify order → approve/reject → process → notify customer
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {['', 'pending', 'under_review', 'verified', 'approved', 'rejected', 'processed', 'closed'].map(
          (s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                filter === s ? 'bg-indigo-600 text-white' : 'border bg-white'
              }`}
            >
              {s ? formatRefundStatus(s) : 'All'}
            </button>
          ),
        )}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading refunds…" />
      </div>

      <div className="mt-6 space-y-2">
        {items.map((r) => (
          <Link
            key={r._id}
            href={`/refunds/${r._id}`}
            className="block rounded-xl border bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="flex justify-between">
              <p className="font-medium">Order …{r.orderId.slice(-6)}</p>
              <p className="font-medium">₱{r.requestedAmount}</p>
            </div>
            <p className="mt-1 text-sm capitalize text-slate-500">
              {formatRefundStatus(r.status)}
              {r.bookingType ? ` · ${r.bookingType.replace(/_/g, ' ')}` : ''}
            </p>
            <p className="mt-1 truncate text-sm text-slate-600">{r.reason}</p>
          </Link>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="text-slate-500">No refund requests.</p>
        )}
      </div>
    </div>
  );
}
