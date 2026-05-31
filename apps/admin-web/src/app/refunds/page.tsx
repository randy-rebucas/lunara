'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { DataPageStatus } from '../../components/data-page-status';
import { filterBySearch, ListControls } from '../../components/list-controls';
import { PageHeader } from '../../components/ui/page-header';
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
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : '';
    return adminFetch<{ items: RefundRow[] }>(`/admin/refunds${q}`);
  }, [filter]);

  const { data, loading, error } = useAdminQuery(load, [filter]);
  const filteredItems = useMemo(() => {
    const rows = data?.items ?? [];
    return filterBySearch(rows.slice(0, limit), search, [
      (r) => r.orderId,
      (r) => r.reason,
      (r) => r.status,
      (r) => r.bookingType,
    ]);
  }, [data?.items, search, limit]);
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Refund requests"
        description="Review → verify order → approve/reject → process → notify customer"
      />

      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'under_review', 'verified', 'approved', 'rejected', 'processed', 'closed'].map(
          (s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              className={`capitalize ${filter === s ? 'filter-chip-active' : 'filter-chip'}`}
            >
              {s ? formatRefundStatus(s) : 'All'}
            </button>
          ),
        )}
      </div>

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Order ID, reason, status…"
        limit={limit}
        onLimitChange={setLimit}
        total={items.length}
        filtered={filteredItems.length}
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading refunds…" />
      </div>

      <div className="mt-6 space-y-2">
        {filteredItems.map((r) => (
          <Link key={r._id} href={`/refunds/${r._id}`} className="list-row block">
            <div className="flex w-full justify-between">
              <p className="font-medium text-slate-900">Order …{r.orderId.slice(-6)}</p>
              <p className="font-medium text-slate-900">₱{r.requestedAmount}</p>
            </div>
            <p className="mt-1 text-sm capitalize text-muted">
              {formatRefundStatus(r.status)}
              {r.bookingType ? ` · ${r.bookingType.replace(/_/g, ' ')}` : ''}
            </p>
            <p className="mt-1 truncate text-sm text-slate-600">{r.reason}</p>
          </Link>
        ))}
        {!loading && !error && filteredItems.length === 0 && (
          <p className="text-sm text-muted">No refund requests.</p>
        )}
      </div>
    </div>
  );
}
