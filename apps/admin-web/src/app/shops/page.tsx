'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { SectionHeading } from '../../components/ui/section-heading';
import { StatCard } from '../../components/ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { formatPesoWhole } from '../../lib/format-peso';
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
    return { shops: shopsRes.shops, branches };
  }, []);

  const { data, loading, error } = useAdminQuery(load, []);
  const shops = data?.shops ?? [];
  const branches = data?.branches ?? [];

  const atCapacity = useMemo(
    () => branches.filter((b) => !b.capacityAvailable).length,
    [branches],
  );

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
        actions={
          <Link href="/branches" className="btn-outline btn-sm">
            Branch network →
          </Link>
        }
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading shops…" />

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Branches" value={branches.length} href="/branches" />
            <StatCard
              label="At capacity"
              value={atCapacity}
              accent={atCapacity > 0 ? 'warning' : undefined}
            />
            <StatCard label="Partner accounts" value={shops.length} />
          </div>

          <section className="mt-10">
            <SectionHeading title="Laundry branches" />
            {branches.length === 0 ? (
              <EmptyState
                title="No branches yet"
                description="Start the API once — branches seed on first booking/availability call."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            )}
          </section>

          <section className="mt-10">
            <SectionHeading title="Partner accounts" />
            {shops.length === 0 ? (
              <EmptyState title="No partner accounts found" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {shops.map((s) => (
                  <div key={s._id} className="card card-body !py-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-slate-900">{s.email ?? s._id}</p>
                      <span className={s.isActive ? 'badge-accent' : 'badge-neutral'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{s.phone ?? '—'}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="font-bold text-slate-900">{s.totalOrders}</p>
                        <p className="text-xs text-muted">Orders</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{formatPesoWhole(s.revenue)}</p>
                        <p className="text-xs text-muted">Revenue</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{s.staffCount}</p>
                        <p className="text-xs text-muted">Staff</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
