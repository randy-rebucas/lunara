'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { filterBySearch, ListControls } from '../../components/list-controls';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface OrderRow {
  _id: string;
  status: string;
  bookingType: string;
  total: number;
  customerEmail?: string;
  branchName?: string;
  slaStatus?: string;
  slaLabel?: string;
  operationsConflict?: boolean;
  updatedAt?: string;
}

export default function MonitorOrdersPage() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    params.set('limit', String(limit));
    const q = params.toString() ? `?${params}` : '';
    return adminFetch<{ items: OrderRow[]; statusCounts: Record<string, number> }>(
      `/admin/orders${q}`,
    );
  }, [filter, limit]);

  const { data, loading, error } = useAdminQuery(load, [filter, limit]);
  const statusCounts = data?.statusCounts ?? {};
  const statuses = Object.keys(statusCounts).sort();
  const filteredItems = useMemo(() => {
    const rows = data?.items ?? [];
    return filterBySearch(rows, search, [
      (o) => o._id,
      (o) => o.customerEmail,
      (o) => o.branchName,
      (o) => o.status,
    ]);
  }, [data?.items, search]);
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Platform-wide order pipeline and status breakdown."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={!filter ? 'filter-chip-active' : 'filter-chip'}
        >
          All
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`capitalize ${filter === s ? 'filter-chip-active' : 'filter-chip'}`}
          >
            {s.replace(/_/g, ' ')} ({statusCounts[s]})
          </button>
        ))}
      </div>

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Order ID, customer, shop, status…"
        limit={limit}
        onLimitChange={setLimit}
        total={items.length}
        filtered={filteredItems.length}
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />
      </div>

      <div className="section-panel mt-6 overflow-hidden">
        <table className="data-table">
          <caption className="sr-only">Platform orders</caption>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Service</th>
              <th scope="col">Shop</th>
              <th scope="col">Status</th>
              <th scope="col">SLA</th>
              <th scope="col" className="text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((o) => (
              <tr key={o._id}>
                <td>
                  <Link href={`/orders/${o._id}`} className="link-primary font-mono text-xs">
                    {o._id.slice(-8)}
                  </Link>
                </td>
                <td className="text-muted">{o.customerEmail ?? '—'}</td>
                <td className="capitalize">{o.bookingType.replace(/_/g, ' ')}</td>
                <td className="text-muted">{o.branchName ?? '—'}</td>
                <td className="capitalize">{o.status.replace(/_/g, ' ')}</td>
                <td className="text-xs">
                  {o.operationsConflict && <span className="text-destructive">Conflict · </span>}
                  {o.slaLabel ?? '—'}
                </td>
                <td className="text-right font-medium">₱{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && filteredItems.length === 0 && (
          <p className="p-6 text-sm text-muted">No orders found.</p>
        )}
      </div>
    </div>
  );
}
