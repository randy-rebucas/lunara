'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LiveBadge } from '../ui/stat-card';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

interface DashboardData {
  counts: {
    activeOrders: number;
    ordersToday: number;
    ridersOnline: number;
    totalRiders: number;
    partners: number;
    staff: number;
    customers: number;
    openTickets: number;
    activePromos: number;
    pendingDispatch: number;
  };
  revenue: { month: number; monthOrders: number };
  recentOrders: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
  }[];
}

type SystemState = 'nominal' | 'attention' | 'critical';

function deriveSystemState(counts: DashboardData['counts']): SystemState {
  if (counts.pendingDispatch >= 10 || counts.openTickets >= 15) return 'critical';
  if (counts.pendingDispatch > 0 || counts.openTickets > 0 || counts.activeOrders >= 50) return 'attention';
  return 'nominal';
}

const systemCopy: Record<SystemState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'All systems nominal',
    detail: 'No critical queue backlogs detected.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Elevated load',
    detail: 'Review dispatch queue and open support tickets.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'High priority',
    detail: 'Immediate ops review recommended.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function statusTone(status: string): string {
  if (status === 'pending_dispatch') return 'badge-warning';
  if (status.includes('cancel')) return 'badge-neutral';
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status.includes('rider') || status.includes('pickup') || status.includes('delivery')) {
    return 'badge-primary';
  }
  return 'badge-neutral';
}

const QUICK_ACTIONS = [
  { href: '/control-tower', label: 'Control tower' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/orders', label: 'Orders' },
  { href: '/riders', label: 'Riders' },
  { href: '/support', label: 'Support' },
  { href: '/revenue', label: 'Revenue' },
] as const;

export function OperationsCenterBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    const data = await adminFetch<DashboardData>('/admin/dashboard');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: () => {
      void reload();
    },
  });

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const system = data ? deriveSystemState(data.counts) : 'nominal';
  const sys = systemCopy[system];

  const riderPct = data && data.counts.totalRiders > 0
    ? Math.round((data.counts.ridersOnline / data.counts.totalRiders) * 100)
    : 0;

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Lunara platform</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Operations center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Live telemetry — orders, fleet, revenue, and support
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : (
              <span className="badge-neutral">Polling</span>
            )}
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading telemetry…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${sys.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sys.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{sys.label}</p>
              <p className="text-xs text-muted">{sys.detail}</p>
            </div>
            {data.counts.pendingDispatch > 0 ? (
              <Link href="/dispatch" className="badge-warning px-3 py-1 text-xs font-semibold">
                {data.counts.pendingDispatch} dispatch
              </Link>
            ) : null}
            {data.counts.openTickets > 0 ? (
              <Link href="/support" className="badge-primary px-3 py-1 text-xs font-semibold">
                {data.counts.openTickets} tickets
              </Link>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCell
              label="Dispatch queue"
              value={data.counts.pendingDispatch}
              href="/dispatch"
              highlight={data.counts.pendingDispatch > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Active pipeline"
              value={data.counts.activeOrders}
              sub="in-flight orders"
              href="/orders"
            />
            <MetricCell
              label="Orders today"
              value={data.counts.ordersToday}
              sub="created since midnight"
              href="/orders"
            />
            <MetricCell
              label="Fleet online"
              value={`${data.counts.ridersOnline}/${data.counts.totalRiders}`}
              sub={`${riderPct}% availability`}
              href="/riders"
              highlight={riderPct < 20 && data.counts.totalRiders > 0 ? 'warning' : 'accent'}
            />
            <MetricCell
              label="Revenue MTD"
              value={formatPeso(data.revenue.month, true)}
              sub={`${data.revenue.monthOrders} completed`}
              href="/revenue"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="dc-panel lg:col-span-2">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Platform registry</h2>
                <p className="text-xs text-muted">Accounts & partners</p>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-3">
                {[
                  { label: 'Customers', value: data.counts.customers, href: undefined },
                  { label: 'Staff', value: data.counts.staff, href: undefined },
                  { label: 'Shops', value: data.counts.partners, href: '/shops' },
                  { label: 'Promos', value: data.counts.activePromos, href: '/promotions' },
                  { label: 'Tickets', value: data.counts.openTickets, href: '/support' },
                  { label: 'Riders', value: data.counts.totalRiders, href: '/riders' },
                ].map((row) => (
                  <div key={row.label} className="bg-surface px-4 py-3">
                    <dt className="dc-label">{row.label}</dt>
                    {row.href ? (
                      <dd className="mt-1">
                        <Link href={row.href} className="dc-value-sm link-primary hover:underline">
                          {row.value.toLocaleString()}
                        </Link>
                      </dd>
                    ) : (
                      <dd className="dc-value-sm mt-1 text-slate-900">{row.value.toLocaleString()}</dd>
                    )}
                  </div>
                ))}
              </dl>
            </section>

            <section className="dc-panel lg:col-span-3">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Live order feed</h2>
                  <p className="text-xs text-muted">Most recently updated</p>
                </div>
                <Link href="/orders" className="link-primary text-xs font-medium">
                  Full ledger →
                </Link>
              </div>
              {data.recentOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No orders in feed.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <caption className="sr-only">Recent platform orders</caption>
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Service</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.map((o) => (
                        <tr key={o._id}>
                          <td>
                            <Link
                              href={`/orders/${o._id}`}
                              className="link-primary text-code font-semibold"
                            >
                              {formatOrderId(o._id)}
                            </Link>
                          </td>
                          <td className="capitalize text-muted">{formatSlugLabel(o.bookingType)}</td>
                          <td>
                            <span className={`${statusTone(o.status)} capitalize`}>
                              {formatSlugLabel(o.status)}
                            </span>
                          </td>
                          <td className="text-right text-sm font-medium tabular-nums">
                            {formatPeso(o.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
