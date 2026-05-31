'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
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
      <PageHeader
        title="Shops"
        description={
          <>
            Partner accounts and branch load. For hierarchy, managers, and quotas see{' '}
            <Link href="/branches" className="link-primary">
              Branch network
            </Link>
            .
          </>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading shops…" />
      </div>

      <h3 className="mt-8 text-lg font-semibold text-slate-900">Laundry branches</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <div
            key={b._id}
            className={`card card-body !py-5 ${!b.capacityAvailable ? 'ring-amber-300/60' : ''}`}
          >
            <p className="font-mono text-xs text-primary">{b.code}</p>
            <p className="font-medium text-slate-900">{b.name}</p>
            <p className="text-sm text-muted">
              {b.line1}, {b.city}
            </p>
            <div className="mt-3 flex justify-between text-sm">
              <span>
                Load: {b.activeOrders}/{b.maxActiveOrders}
              </span>
              <span
                className={
                  b.capacityAvailable ? 'text-accent' : 'font-medium text-amber-700'
                }
              >
                {b.capacityAvailable ? 'Available' : 'At capacity'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && branches.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          No branches yet. Start the API once — branches seed on first booking/availability call.
        </p>
      )}

      <h3 className="mt-10 text-lg font-semibold text-slate-900">Partner accounts</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shops.map((s) => (
          <div key={s._id} className="card card-body !py-6">
            <div className="flex items-start justify-between">
              <p className="font-medium text-slate-900">{s.email ?? s._id}</p>
              <span className={s.isActive ? 'badge-accent capitalize' : 'badge-neutral capitalize'}>
                {s.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{s.phone ?? '—'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="font-bold text-slate-900">{s.totalOrders}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">₱{s.revenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">{s.staffCount}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && shops.length === 0 && (
        <p className="mt-4 text-sm text-muted">No partner accounts found.</p>
      )}
    </div>
  );
}
