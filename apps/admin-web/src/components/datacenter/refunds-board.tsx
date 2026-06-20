'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  requestedAmount: number;
  reason: string;
  bookingType?: string;
  orderStatus?: string;
}

interface RefundCounts {
  pending: number;
  underReview: number;
  approved: number;
}

type RefundQueueState = 'nominal' | 'attention' | 'critical';

const STATUS_FILTERS = [
  '',
  'pending',
  'under_review',
  'verified',
  'approved',
  'rejected',
  'processed',
  'closed',
] as const;

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/orders', label: 'Orders' },
  { href: '/support', label: 'Support' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/reports', label: 'Reports' },
] as const;

const refundCopy: Record<
  RefundQueueState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Refund queue clear',
    detail: 'No pending or in-review refund requests.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Refunds need review',
    detail: 'Pending or under-review requests await verification and decision.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Refund backlog elevated',
    detail: 'High volume of open refund requests — prioritize oldest first.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function deriveRefundState(counts: RefundCounts): RefundQueueState {
  const open = counts.pending + counts.underReview;
  if (open >= 8) return 'critical';
  if (open > 0) return 'attention';
  return 'nominal';
}

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'badge-warning';
  if (status === 'under_review' || status === 'verified') return 'badge-primary';
  if (status === 'approved' || status === 'processed') return 'badge-accent';
  if (status === 'rejected') return 'badge-danger';
  return 'badge-neutral';
}

function needsAttention(r: RefundRow) {
  return r.status === 'pending' || r.status === 'under_review';
}

export function RefundsBoard() {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : '';
    const data = await adminFetch<{ items: RefundRow[]; counts: RefundCounts }>(
      `/admin/refunds${q}`,
    );
    setLastUpdated(new Date());
    return data;
  }, [filter]);

  const { data, loading, error, reload } = useAdminQuery(load, [filter]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const counts = data?.counts ?? { pending: 0, underReview: 0, approved: 0 };
  const items = data?.items ?? [];

  const filteredItems = useMemo(() => {
    const searched = filterBySearch(items, search, [
      (r) => r.orderId,
      (r) => r.reason,
      (r) => r.status,
      (r) => r.bookingType,
    ]);
    return searched.slice(0, limit);
  }, [items, search, limit]);

  const attentionRefunds = useMemo(() => items.filter(needsAttention).slice(0, 12), [items]);

  const queueValue = useMemo(
    () =>
      items
        .filter((r) => r.status === 'pending' || r.status === 'under_review')
        .reduce((sum, r) => sum + r.requestedAmount, 0),
    [items],
  );

  const queueState = deriveRefundState(counts);
  const copy = refundCopy[queueState];

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
            <p className="dc-eyebrow">Finance ops</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Refunds
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Refund request queue — review, verify order payment, approve or reject, then process
              and notify the customer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-neutral">Polling</span>
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
            <a href="#refund-ledger" className="btn-primary btn-sm">
              Review queue
            </a>
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
          Loading refunds…
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
            {counts.pending > 0 ? (
              <a href="#refund-attention" className="badge-warning px-3 py-1 text-xs font-semibold">
                {counts.pending} pending
              </a>
            ) : null}
            {counts.underReview > 0 ? (
              <span className="badge-primary px-3 py-1 text-xs font-semibold">
                {counts.underReview} under review
              </span>
            ) : null}
            {counts.approved > 0 ? (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">
                {counts.approved} approved
              </span>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Pending"
              value={counts.pending}
              href="#refund-attention"
              highlight={counts.pending > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Under review"
              value={counts.underReview}
              highlight={counts.underReview > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Approved"
              value={counts.approved}
              sub="awaiting process"
              highlight={counts.approved > 0 ? 'accent' : undefined}
            />
            <MetricCell
              label="Queue value"
              value={formatPeso(queueValue)}
              sub="pending + in review"
              highlight={queueValue > 0 ? 'warning' : undefined}
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

          {attentionRefunds.length > 0 ? (
            <section className="dc-panel" id="refund-attention">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Review queue</h2>
                  <p className="text-xs text-muted">
                    Pending and under-review requests — oldest in current load first
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[720px]">
                  <caption className="sr-only">Refund requests needing review</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Service</th>
                      <th scope="col">Reason</th>
                      <th scope="col">
                        <span className="sr-only">Review</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionRefunds.map((r) => (
                      <tr key={r._id}>
                        <td className="font-medium tabular-nums">
                          {formatOrderId(r.orderId)}
                        </td>
                        <td className="tabular-nums">{formatPeso(r.requestedAmount)}</td>
                        <td>
                          <span className={statusBadgeClass(r.status)}>
                            {formatRefundStatus(r.status)}
                          </span>
                        </td>
                        <td className="capitalize text-muted">
                          {r.bookingType ? formatSlugLabel(r.bookingType) : '—'}
                        </td>
                        <td className="max-w-[14rem] truncate text-muted" title={r.reason}>
                          {r.reason}
                        </td>
                        <td>
                          <Link href={`/refunds/${r._id}`} className="link-primary text-xs font-medium">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Status filter</h2>
                <p className="text-xs text-muted">
                  {filter
                    ? `Showing ${formatRefundStatus(filter)} requests`
                    : `${items.length} requests in current load`}
                </p>
              </div>
              {filter ? (
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => setFilter('')}
                >
                  Clear filter
                </button>
              ) : null}
            </div>
            <div className="dc-panel-body pt-1">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s || 'all'}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={filter === s ? 'filter-chip-active' : 'filter-chip'}
                    aria-pressed={filter === s}
                  >
                    {s ? formatRefundStatus(s) : 'All statuses'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Order ID, reason, status…"
            limit={limit}
            onLimitChange={setLimit}
            total={items.length}
            filtered={filteredItems.length}
          />

          <section className="dc-panel" id="refund-ledger">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Refund ledger</h2>
                <p className="text-xs text-muted">
                  Showing {filteredItems.length} of {items.length} requests
                </p>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No refund requests</p>
                <p className="mt-1 text-sm text-muted">
                  {search || filter
                    ? 'No requests match this filter or search.'
                    : 'Customers submit refund requests from their order history.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[880px]">
                  <caption className="sr-only">Refund request ledger</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col" className="text-right">
                        Requested
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Service</th>
                      <th scope="col">Order status</th>
                      <th scope="col">Reason</th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((r) => (
                      <tr
                        key={r._id}
                        className={
                          r.status === 'pending'
                            ? 'bg-amber-50/40'
                            : r.status === 'under_review'
                              ? 'bg-primary/5'
                              : ''
                        }
                      >
                        <td>
                          <Link
                            href={`/orders/${r.orderId}`}
                            className="link-primary font-medium tabular-nums"
                          >
                            {formatOrderId(r.orderId)}
                          </Link>
                        </td>
                        <td className="text-right tabular-nums font-medium">
                          {formatPeso(r.requestedAmount)}
                        </td>
                        <td>
                          <span className={statusBadgeClass(r.status)}>
                            {formatRefundStatus(r.status)}
                          </span>
                        </td>
                        <td className="capitalize text-muted">
                          {r.bookingType ? formatSlugLabel(r.bookingType) : '—'}
                        </td>
                        <td className="capitalize text-muted">
                          {r.orderStatus ? formatSlugLabel(r.orderStatus) : '—'}
                        </td>
                        <td className="max-w-[16rem] truncate text-muted" title={r.reason}>
                          {r.reason}
                        </td>
                        <td>
                          <Link href={`/refunds/${r._id}`} className="link-primary text-xs font-medium">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Refund workflow</h2>
                <p className="text-xs text-muted">Standard admin review path</p>
              </div>
              <div className="dc-panel-body">
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      1
                    </span>
                    <p className="text-muted">
                      <span className="font-medium text-slate-900">Review</span> — open the request
                      and confirm customer reason.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      2
                    </span>
                    <p className="text-muted">
                      <span className="font-medium text-slate-900">Verify order</span> — payment
                      must match and order must be eligible.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      3
                    </span>
                    <p className="text-muted">
                      <span className="font-medium text-slate-900">Approve or reject</span> — set
                      approved amount or rejection reason.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      4
                    </span>
                    <p className="text-muted">
                      <span className="font-medium text-slate-900">Process & notify</span> — credit
                      wallet or reverse payment, then close the case.
                    </p>
                  </li>
                </ol>
              </div>
            </section>

            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Quick filters</h2>
                <p className="text-xs text-muted">Jump to common queue slices</p>
              </div>
              <div className="dc-panel-body flex flex-wrap gap-2">
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setFilter('pending')}
                >
                  Pending ({counts.pending})
                </button>
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setFilter('under_review')}
                >
                  Under review ({counts.underReview})
                </button>
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setFilter('approved')}
                >
                  Approved ({counts.approved})
                </button>
                <button type="button" className="filter-chip" onClick={() => setFilter('rejected')}>
                  Rejected
                </button>
                <button type="button" className="filter-chip" onClick={() => setFilter('')}>
                  Clear all
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
