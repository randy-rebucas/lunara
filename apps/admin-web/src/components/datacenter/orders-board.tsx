'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { LiveBadge } from '../ui/stat-card';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

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

type PipelineState = 'nominal' | 'attention' | 'critical';

function summarizeCounts(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const pendingDispatch = counts.pending_dispatch ?? 0;
  const completed = counts.completed ?? 0;
  const cancelled = counts.cancelled ?? 0;
  const refunded = counts.refunded ?? 0;
  const active = Math.max(0, total - completed - cancelled - refunded - pendingDispatch);
  return { total, pendingDispatch, active, completed };
}

function derivePipelineState(
  summary: ReturnType<typeof summarizeCounts>,
  conflicts: number,
  slaBreaches: number,
): PipelineState {
  if (conflicts > 0 || slaBreaches > 0) return 'critical';
  if (summary.pendingDispatch > 0 || summary.active > 0) return 'attention';
  return 'nominal';
}

const pipelineCopy: Record<
  PipelineState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Pipeline nominal',
    detail: 'No dispatch backlog or SLA exceptions in the loaded ledger.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Pipeline active',
    detail: 'Orders in-flight or awaiting shop / rider dispatch.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Exceptions flagged',
    detail: 'Operational conflicts or SLA breaches need review.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function statusBadgeClass(status: string) {
  if (status === 'pending_dispatch') return 'badge-warning';
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status.includes('cancel') || status === 'refunded') return 'badge-neutral';
  if (status.includes('rider') || status.includes('pickup') || status.includes('delivery')) {
    return 'badge-primary';
  }
  return 'badge-neutral';
}

function slaBadgeClass(status?: string) {
  if (status === 'breached') return 'badge-danger';
  if (status === 'warning') return 'badge-warning';
  return 'badge-neutral';
}

function needsAttention(o: OrderRow) {
  return (
    o.status === 'pending_dispatch' ||
    o.operationsConflict ||
    o.slaStatus === 'breached' ||
    o.slaStatus === 'warning'
  );
}

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/riders', label: 'Riders' },
  { href: '/support', label: 'Support' },
] as const;

export function OrdersBoard() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    params.set('limit', String(limit));
    const q = params.toString() ? `?${params}` : '';
    const data = await adminFetch<{ items: OrderRow[]; statusCounts: Record<string, number> }>(
      `/admin/orders${q}`,
    );
    setLastUpdated(new Date());
    return data;
  }, [filter, limit]);

  const { data, loading, error, reload } = useAdminQuery(load, [filter, limit]);

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

  const statusCounts = data?.statusCounts ?? {};
  const statuses = Object.keys(statusCounts).sort();
  const items = data?.items ?? [];
  const summary = useMemo(() => summarizeCounts(statusCounts), [statusCounts]);

  const filteredItems = useMemo(
    () =>
      filterBySearch(items, search, [
        (o) => o._id,
        (o) => o.customerEmail,
        (o) => o.branchName,
        (o) => o.status,
      ]),
    [items, search],
  );

  const conflictsInView = filteredItems.filter((o) => o.operationsConflict).length;
  const slaBreachesInLoad = items.filter((o) => o.slaStatus === 'breached').length;
  const conflictsInLoad = items.filter((o) => o.operationsConflict).length;
  const attentionOrders = useMemo(
    () => items.filter(needsAttention).slice(0, 12),
    [items],
  );

  const pipelineState = derivePipelineState(summary, conflictsInLoad, slaBreachesInLoad);
  const copy = pipelineCopy[pipelineState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Pipeline</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Orders
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Platform-wide order ledger — filter by status, search customers and shops, open ops
              for rider assignment.
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
            <Link href="/control-tower" className="btn-outline btn-sm">
              Control tower
            </Link>
            <Link href="/dispatch" className="btn-primary btn-sm">
              Dispatch
            </Link>
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
          Loading orders…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {summary.pendingDispatch > 0 ? (
              <a href="#order-attention" className="badge-warning px-3 py-1 text-xs font-semibold">
                {summary.pendingDispatch} pending dispatch
              </a>
            ) : null}
            {conflictsInLoad > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">
                {conflictsInLoad} conflict{conflictsInLoad === 1 ? '' : 's'}
              </span>
            ) : null}
            {slaBreachesInLoad > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">
                {slaBreachesInLoad} SLA breach{slaBreachesInLoad === 1 ? '' : 'es'}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell label="Total ledger" value={summary.total.toLocaleString()} />
            <MetricCell
              label="Pending dispatch"
              value={summary.pendingDispatch}
              href="/dispatch"
              highlight={summary.pendingDispatch > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Active pipeline"
              value={summary.active}
              sub="in-flight orders"
              highlight={summary.active > 0 ? 'primary' : undefined}
            />
            <MetricCell label="Completed" value={summary.completed} highlight="accent" />
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

          {attentionOrders.length > 0 ? (
            <section className="dc-panel" id="order-attention">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Attention queue</h2>
                  <p className="text-xs text-muted">
                    {attentionOrders.length} loaded order{attentionOrders.length === 1 ? '' : 's'}{' '}
                    needing dispatch, SLA review, or conflict resolution
                  </p>
                </div>
                <Link href="/control-tower" className="link-primary text-xs font-medium">
                  Control tower →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <caption className="sr-only">Orders needing attention</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Status</th>
                      <th scope="col">SLA</th>
                      <th scope="col">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionOrders.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link
                            href={`/orders/${o._id}`}
                            className="link-primary text-code font-semibold"
                          >
                            {formatOrderId(o._id)}
                          </Link>
                        </td>
                        <td className="max-w-[12rem] truncate text-muted" title={o.customerEmail}>
                          {o.customerEmail ?? '—'}
                        </td>
                        <td>
                          <span className={`${statusBadgeClass(o.status)} capitalize`}>
                            {formatSlugLabel(o.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            {o.operationsConflict ? (
                              <span className="badge-danger">Conflict</span>
                            ) : null}
                            {o.slaLabel ? (
                              <span className={slaBadgeClass(o.slaStatus)}>{o.slaLabel}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {o.status === 'pending_dispatch' ? (
                            <Link href="/dispatch" className="link-primary text-xs font-medium">
                              Dispatch →
                            </Link>
                          ) : (
                            <Link href={`/orders/${o._id}`} className="link-primary text-xs font-medium">
                              Ops →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Order ID, customer, shop, status…"
            limit={limit}
            onLimitChange={setLimit}
            total={items.length}
            filtered={filteredItems.length}
            filterValue={filter}
            onFilterChange={setFilter}
            filterOptions={[
              { value: '', label: 'All statuses', count: summary.total },
              ...statuses.map((s) => ({ value: s, label: formatSlugLabel(s), count: statusCounts[s] })),
            ]}
          />

          <section className="dc-panel" id="order-ledger">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Order ledger</h2>
                <p className="text-xs text-muted">
                  Showing {filteredItems.length} of {items.length} loaded
                  {filter ? ` · ${formatSlugLabel(filter)}` : ''}
                  {conflictsInView > 0
                    ? ` · ${conflictsInView} conflict${conflictsInView === 1 ? '' : 's'}`
                    : ''}
                </p>
              </div>
              <Link href="/control-tower" className="link-primary text-xs font-medium">
                Control tower →
              </Link>
            </div>

            {filteredItems.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No orders found</p>
                <p className="mt-1 text-sm text-muted">
                  {search || filter
                    ? 'Try a different search or clear filters.'
                    : 'Orders will appear as customers book.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[960px]">
                  <caption className="sr-only">Platform orders</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Service</th>
                      <th scope="col">Shop</th>
                      <th scope="col">Status</th>
                      <th scope="col">SLA</th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                      <th scope="col">
                        <span className="sr-only">Operations</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link
                            href={`/orders/${o._id}`}
                            className="link-primary text-code font-semibold"
                          >
                            {formatOrderId(o._id)}
                          </Link>
                        </td>
                        <td className="max-w-[12rem] truncate text-muted" title={o.customerEmail}>
                          {o.customerEmail ?? '—'}
                        </td>
                        <td className="capitalize text-muted">{formatSlugLabel(o.bookingType)}</td>
                        <td className="max-w-[10rem] truncate text-muted" title={o.branchName}>
                          {o.branchName ?? '—'}
                        </td>
                        <td>
                          <span className={`${statusBadgeClass(o.status)} capitalize`}>
                            {formatSlugLabel(o.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            {o.operationsConflict ? (
                              <span className="badge-danger">Conflict</span>
                            ) : null}
                            {o.slaLabel ? (
                              <span className={slaBadgeClass(o.slaStatus)}>{o.slaLabel}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right text-sm font-medium tabular-nums">
                          {formatPeso(o.total)}
                        </td>
                        <td>
                          <Link href={`/orders/${o._id}`} className="link-primary text-xs font-medium">
                            Ops →
                          </Link>
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
