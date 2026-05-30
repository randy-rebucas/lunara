'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Shop {
  _id: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  staffCount: number;
  totalOrders: number;
  revenue: number;
}

interface Branch {
  _id: string;
  code: string;
  name: string;
  city: string;
  line1: string;
  maxActiveOrders: number;
  activeOrders: number;
  capacityAvailable: boolean;
}


export default function MonitorShopsPage() {
  const load = useCallback(async () => {
    const [shopsRes, branches] = await Promise.all([
      adminFetch<{ shops: Shop[] }>('/admin/shops'),
      adminFetch<Branch[]>('/admin/branches'),
    ]);
    return { shops: shopsRes.shops, branches } as { shops: Shop[]; branches: Branch[] };
  }, []);

  const { data, loading, error } = useAdminQuery(load, []);
  const shops = data?.shops ?? [];
  const branches = data?.branches ?? [];

  return (
    <div>
      <h2 className="text-2xl font-bold">Monitor shops & branches</h2>
      <p className="mt-1 text-sm text-slate-500">
        Partner accounts and branch load. For hierarchy, managers, and quotas see{' '}
        <a href="/branches" className="text-indigo-600 hover:underline">
          Branch network
        </a>
        .
      </p>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading shops…" />
      </div>

      <h3 className="mt-8 font-semibold">Laundry branches</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <div
            key={b._id}
            className={`rounded-xl border bg-white p-5 shadow-sm ${
              !b.capacityAvailable ? 'border-amber-300' : ''
            }`}
          >
            <p className="font-mono text-xs text-indigo-600">{b.code}</p>
            <p className="font-medium">{b.name}</p>
            <p className="text-sm text-slate-500">
              {b.line1}, {b.city}
            </p>
            <div className="mt-3 flex justify-between text-sm">
              <span>
                Load: {b.activeOrders}/{b.maxActiveOrders}
              </span>
              <span
                className={
                  b.capacityAvailable ? 'text-green-700' : 'font-medium text-amber-700'
                }
              >
                {b.capacityAvailable ? 'Available' : 'At capacity'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && branches.length === 0 && (
        <p className="mt-4 text-slate-500">
          No branches yet. Start the API once — branches seed on first booking/availability call.
        </p>
      )}

      <h3 className="mt-10 font-semibold">Partner accounts</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shops.map((s) => (
          <div key={s._id} className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="font-medium">{s.email ?? s._id}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {s.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{s.phone ?? '—'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-bold">{s.totalOrders}</p>
                <p className="text-xs text-slate-500">Orders</p>
              </div>
              <div>
                <p className="font-bold">₱{s.revenue.toFixed(0)}</p>
                <p className="text-xs text-slate-500">Revenue</p>
              </div>
              <div>
                <p className="font-bold">{s.staffCount}</p>
                <p className="text-xs text-slate-500">Staff</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && shops.length === 0 && (
        <p className="mt-4 text-slate-500">No partner accounts found.</p>
      )}
    </div>
  );
}
