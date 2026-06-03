'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { DataPageStatus } from '../../components/data-page-status';
import { EmptyState } from '../../components/empty-state';
import { filterBySearch, ListControls } from '../../components/list-controls';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
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

const STATUS_FILTERS = [
  '',
  'pending',
  'under_review',
  'verified',
  'approved',
  'rejected',
  'processed',
  'closed',
] as const;

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : '';
    return adminFetch<{ items: RefundRow[] }>(`/admin/refunds${q}`);
  }, [filter]);

  const { data, loading, error } = useAdminQuery(load, [filter]);
  const items = data?.items ?? [];

  const filteredItems = useMemo(() => {
    const searched = filterBySearch(items, search, [
      (r) => r.orderId,
      (r) => r.reason,
      (r) => r.status,
      (r) => r.bookingType,
    ]);
    return searched.slice(0, limit);
  }, [items, search, limit]);

  return (
    <div>
      <PageHeader
        title="Refund requests"
        description="Review → verify order → approve/reject → process → notify customer"
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`capitalize ${filter === s ? 'filter-chip-active' : 'filter-chip'}`}
            aria-pressed={filter === s}
          >
            {s ? formatRefundStatus(s) : 'All'}
          </button>
        ))}
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

      {!loading && !error && (
        <div className="mt-6 space-y-2">
          {filteredItems.length === 0 ? (
            <EmptyState
              title="No refund requests"
              description={filter ? 'No requests match this status filter.' : undefined}
            />
          ) : (
            filteredItems.map((r) => (
              <Link key={r._id} href={`/refunds/${r._id}`} className="list-row block">
                <div className="flex w-full justify-between gap-4">
                  <p className="font-medium text-slate-900">Order …{r.orderId.slice(-6)}</p>
                  <p className="font-medium text-slate-900">{formatPeso(r.requestedAmount)}</p>
                </div>
                <p className="mt-1 text-sm capitalize text-muted">
                  {formatRefundStatus(r.status)}
                  {r.bookingType ? ` · ${formatSlugLabel(r.bookingType)}` : ''}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">{r.reason}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
