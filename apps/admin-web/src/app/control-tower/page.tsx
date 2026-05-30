'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-tracking-socket';

interface ControlTowerData {
  counts: {
    pendingDispatch: number;
    awaitingPartnerAccept: number;
    awaitingPickupRider: number;
    awaitingDeliveryRider: number;
    slaBreaches: number;
    conflicts: number;
    openTickets: number;
  };
  watchlist: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    branchName?: string;
    dispatchStatus?: string;
    operationsConflict?: boolean;
    sla: { status: string; label: string };
  }[];
}

export default function ControlTowerPage() {
  const load = useCallback(() => adminFetch<ControlTowerData>('/admin/control-tower'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const { connected: socketLive } = useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: () => {
      void reload();
    },
  });

  if (loading || error || !data) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Control tower</h2>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading control tower…" />
      </div>
    );
  }

  const stats = [
    { label: 'Dispatch dashboard', value: data.counts.pendingDispatch, href: '/dispatch' },
    { label: 'Partner accept pending', value: data.counts.awaitingPartnerAccept, href: '/orders' },
    { label: 'Pickup rider needed', value: data.counts.awaitingPickupRider, href: '/orders' },
    {
      label: 'Delivery rider needed',
      value: data.counts.awaitingDeliveryRider,
      href: '/orders',
    },
    { label: 'SLA breaches', value: data.counts.slaBreaches, href: '/orders' },
    { label: 'Flagged conflicts', value: data.counts.conflicts, href: '/orders' },
    { label: 'Open support tickets', value: data.counts.openTickets, href: '/support' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Control tower</h2>
        {socketLive ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            ● Live
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Logistics hub — review orders, assign shops and riders, monitor SLA, resolve conflicts.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300"
          >
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h3 className="font-semibold">Priority watchlist</h3>
        <div className="mt-4 space-y-2">
          {data.watchlist.length === 0 ? (
            <p className="text-slate-500">No priority items right now.</p>
          ) : (
            data.watchlist.map((o) => (
              <Link
                key={o._id}
                href={`/orders/${o._id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-4 hover:border-indigo-300"
              >
                <div>
                  <p className="font-medium capitalize">
                    {o.bookingType.replace(/_/g, ' ')} · ₱{o.total}
                  </p>
                  <p className="text-sm text-slate-500">
                    {o.branchName ?? 'Unassigned shop'} · {o.dispatchStatus?.replace(/_/g, ' ') ?? o.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {o.operationsConflict && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">Conflict</span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      o.sla.status === 'breached'
                        ? 'bg-red-100 text-red-800'
                        : o.sla.status === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {o.sla.label}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
