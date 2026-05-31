'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard, LiveBadge } from '../../components/ui/stat-card';
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
        <PageHeader
          title="Control tower"
          description="Logistics hub — review orders, assign shops and riders, monitor SLA, resolve conflicts."
        />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading control tower…" />
      </div>
    );
  }

  const stats = [
    { label: 'Dispatch queue', value: data.counts.pendingDispatch, href: '/dispatch', accent: 'warning' as const },
    { label: 'Partner accept pending', value: data.counts.awaitingPartnerAccept, href: '/orders' },
    { label: 'Pickup rider needed', value: data.counts.awaitingPickupRider, href: '/orders' },
    { label: 'Delivery rider needed', value: data.counts.awaitingDeliveryRider, href: '/orders' },
    { label: 'SLA breaches', value: data.counts.slaBreaches, href: '/orders' },
    { label: 'Flagged conflicts', value: data.counts.conflicts, href: '/orders' },
    { label: 'Open support tickets', value: data.counts.openTickets, href: '/support' },
  ];

  return (
    <div>
      <PageHeader
        title="Control tower"
        description="Logistics hub — review orders, assign shops and riders, monitor SLA, resolve conflicts."
        badge={socketLive ? <LiveBadge /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <section className="mt-10">
        <h3 className="text-lg font-semibold text-slate-900">Priority watchlist</h3>
        <div className="mt-4 space-y-2">
          {data.watchlist.length === 0 ? (
            <p className="text-sm text-muted">No priority items right now.</p>
          ) : (
            data.watchlist.map((o) => (
              <Link key={o._id} href={`/orders/${o._id}`} className="list-row flex-wrap">
                <div>
                  <p className="font-medium capitalize text-slate-900">
                    {o.bookingType.replace(/_/g, ' ')} · ₱{o.total}
                  </p>
                  <p className="text-sm text-muted">
                    {o.branchName ?? 'Unassigned shop'} ·{' '}
                    {o.dispatchStatus?.replace(/_/g, ' ') ?? o.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {o.operationsConflict && <span className="badge-danger">Conflict</span>}
                  <span
                    className={
                      o.sla.status === 'breached'
                        ? 'badge-danger'
                        : o.sla.status === 'warning'
                          ? 'badge-warning'
                          : 'badge-neutral'
                    }
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
