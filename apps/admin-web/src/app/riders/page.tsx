'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RiderRow {
  _id: string;
  email?: string;
  phone?: string;
  isOnline: boolean;
  isActive: boolean;
  vehicleType: string;
  totalEarnings: number;
  todayEarnings: number;
  activeTasks: number;
}

export default function MonitorRidersPage() {
  const load = useCallback(() => adminFetch<RiderRow[]>('/admin/riders'), []);
  const { data: riders, loading, error } = useAdminQuery(load, []);
  const online = (riders ?? []).filter((r) => r.isOnline).length;

  return (
    <div>
      <PageHeader
        title="Riders"
        description={
          loading
            ? 'Loading riders…'
            : `${online} of ${riders?.length ?? 0} riders online · active pickup/delivery tasks`
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading riders…" />
      </div>

      <div className="mt-6 space-y-3">
        {(riders ?? []).map((r) => (
          <div key={r._id} className="card card-body flex flex-wrap items-center justify-between gap-4 !py-5">
            <div>
              <p className="font-medium text-slate-900">{r.email ?? r._id}</p>
              <p className="text-sm text-muted">
                {r.phone ?? '—'} · {r.vehicleType}
                {!r.isActive && ' · inactive account'}
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${r.isOnline ? 'bg-accent' : 'bg-slate-300'}`}
                  aria-hidden
                />
                {r.isOnline ? 'Online' : 'Offline'}
              </span>
              <span>{r.activeTasks} active tasks</span>
              <span>Today ₱{r.todayEarnings}</span>
              <span>Total ₱{r.totalEarnings}</span>
            </div>
          </div>
        ))}
        {!loading && !error && (riders ?? []).length === 0 && (
          <p className="text-sm text-muted">No riders. Seed rider@lunara.dev and run API seed.</p>
        )}
      </div>
    </div>
  );
}
