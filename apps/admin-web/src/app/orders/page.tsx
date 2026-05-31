'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
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

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : '';
    return adminFetch<{ items: OrderRow[]; statusCounts: Record<string, number> }>(
      `/admin/orders${q}`,
    );
  }, [filter]);

  const { data, loading, error } = useAdminQuery(load, [filter]);
  const items = data?.items ?? [];
  const statusCounts = data?.statusCounts ?? {};
  const statuses = Object.keys(statusCounts).sort();

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

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />
      </div>

      <div className="section-panel mt-6 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Shop</th>
              <th>Status</th>
              <th>SLA</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
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
        {!loading && !error && items.length === 0 && (
          <p className="p-6 text-sm text-muted">No orders found.</p>
        )}
      </div>
    </div>
  );
}
