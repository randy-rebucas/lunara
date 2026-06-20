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

type OpsState = 'nominal' | 'attention' | 'critical';

function deriveOpsState(counts: ControlTowerData['counts']): OpsState {
  if (counts.slaBreaches > 0 || counts.conflicts > 0) return 'critical';
  if (
    counts.pendingDispatch > 0 ||
    counts.awaitingPartnerAccept > 0 ||
    counts.awaitingPickupRider > 0 ||
    counts.awaitingDeliveryRider > 0
  ) {
    return 'attention';
  }
  return 'nominal';
}

const opsCopy: Record<OpsState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Logistics nominal',
    detail: 'No SLA breaches or flagged conflicts in the watchlist.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Action required',
    detail: 'Orders waiting on shop assignment, partner accept, or rider dispatch.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Critical exceptions',
    detail: 'SLA breaches or operational conflicts need immediate review.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function slaBadgeClass(status: string) {
  if (status === 'breached') return 'badge-danger';
  if (status === 'warning') return 'badge-warning';
  return 'badge-neutral';
}

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/orders', label: 'Orders' },
  { href: '/riders', label: 'Riders' },
  { href: '/support', label: 'Support' },
] as const;

export function ControlTowerBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    const data = await adminFetch<ControlTowerData>('/admin/control-tower');
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

  const ops = data ? deriveOpsState(data.counts) : 'nominal';
  const copy = opsCopy[ops];
  const c = data?.counts;

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const backlogTotal = c
    ? c.pendingDispatch +
      c.awaitingPartnerAccept +
      c.awaitingPickupRider +
      c.awaitingDeliveryRider
    : 0;

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Logistics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Control tower
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              SLA watchlist, dispatch gaps, partner accept, and rider assignment — live from the
              platform pipeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : <span className="badge-neutral">Polling</span>}
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
          Loading control tower…
        </div>
      ) : null}

      {data && c ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {backlogTotal > 0 ? (
              <span className="dc-sublabel tabular-nums">{backlogTotal} in backlog</span>
            ) : null}
            {c.slaBreaches > 0 ? (
              <Link href="/orders" className="badge-danger px-3 py-1 text-xs font-semibold">
                {c.slaBreaches} SLA
              </Link>
            ) : null}
            {c.conflicts > 0 ? (
              <Link href="/orders" className="badge-danger px-3 py-1 text-xs font-semibold">
                {c.conflicts} conflicts
              </Link>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetricCell
              label="Dispatch queue"
              value={c.pendingDispatch}
              href="/dispatch"
              highlight={c.pendingDispatch > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Partner accept"
              value={c.awaitingPartnerAccept}
              sub="awaiting shop"
              href="/orders"
              highlight={c.awaitingPartnerAccept > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Pickup rider"
              value={c.awaitingPickupRider}
              sub="not assigned"
              href="/orders"
              highlight={c.awaitingPickupRider > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Delivery rider"
              value={c.awaitingDeliveryRider}
              sub="ready lane"
              href="/orders"
              highlight={c.awaitingDeliveryRider > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="SLA breaches"
              value={c.slaBreaches}
              href="/orders"
              highlight={c.slaBreaches > 0 ? 'danger' : undefined}
            />
            <MetricCell
              label="Conflicts"
              value={c.conflicts}
              href="/orders"
              highlight={c.conflicts > 0 ? 'danger' : undefined}
            />
            <MetricCell
              label="Open tickets"
              value={c.openTickets}
              href="/support"
              highlight={c.openTickets > 0 ? 'accent' : undefined}
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

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Priority watchlist</h2>
                <p className="text-xs text-muted">
                  {data.watchlist.length} order{data.watchlist.length === 1 ? '' : 's'} needing
                  attention
                </p>
              </div>
              <Link href="/orders" className="link-primary text-xs font-medium">
                Full ledger →
              </Link>
            </div>

            {data.watchlist.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No priority items — pipeline is clear.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Priority operations watchlist</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Service</th>
                      <th scope="col">Shop</th>
                      <th scope="col">Pipeline</th>
                      <th scope="col">Flags</th>
                      <th scope="col">SLA</th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.watchlist.map((o) => (
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
                        <td className="max-w-[10rem] truncate text-muted" title={o.branchName}>
                          {o.branchName ?? '—'}
                        </td>
                        <td className="capitalize text-sm text-slate-800">
                          {o.dispatchStatus
                            ? formatSlugLabel(o.dispatchStatus)
                            : formatSlugLabel(o.status)}
                        </td>
                        <td>
                          {o.operationsConflict ? (
                            <span className="badge-danger">Conflict</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={slaBadgeClass(o.sla.status)}>{o.sla.label}</span>
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
      ) : null}
    </div>
  );
}
