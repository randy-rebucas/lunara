'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
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
      <h2 className="text-2xl font-bold">Monitor riders</h2>
      <p className="mt-1 text-sm text-slate-500">
        {loading
          ? 'Loading riders…'
          : `${online} of ${riders?.length ?? 0} riders online · active pickup/delivery tasks`}
      </p>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading riders…" />
      </div>

      <div className="mt-6 space-y-3">
        {(riders ?? []).map((r) => (
          <div key={r._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5 shadow-sm">
            <div>
              <p className="font-medium">{r.email ?? r._id}</p>
              <p className="text-sm text-slate-500">
                {r.phone ?? '—'} · {r.vehicleType}
                {!r.isActive && ' · inactive account'}
              </p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${r.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}
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
          <p className="text-slate-500">No riders. Seed rider@lunara.dev and run API seed.</p>
        )}
      </div>
    </div>
  );
}
