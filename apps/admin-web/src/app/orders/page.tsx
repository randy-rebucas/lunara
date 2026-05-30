'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
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
      <h2 className="text-2xl font-bold">Monitor orders</h2>
      <p className="mt-1 text-sm text-slate-500">Platform-wide order pipeline and status breakdown.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={`rounded-lg px-3 py-1.5 text-sm ${!filter ? 'bg-indigo-600 text-white' : 'border bg-white'}`}
        >
          All
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              filter === s ? 'bg-indigo-600 text-white' : 'border bg-white'
            }`}
          >
            {s.replace(/_/g, ' ')} ({statusCounts[s]})
          </button>
        ))}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Shop</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">SLA</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o._id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o._id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                    {o._id.slice(-8)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.customerEmail ?? '—'}</td>
                <td className="px-4 py-3 capitalize">{o.bookingType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-slate-600">{o.branchName ?? '—'}</td>
                <td className="px-4 py-3 capitalize">{o.status.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-xs">
                  {o.operationsConflict && <span className="text-red-600">Conflict · </span>}
                  {o.slaLabel ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">₱{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && items.length === 0 && (
          <p className="p-6 text-slate-500">No orders found.</p>
        )}
      </div>
    </div>
  );
}
