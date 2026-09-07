'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { TILE_TONES, type StatusPillCopy } from './tile-tones';

interface TimelineEntry {
  stage: string;
  label: string;
  at: string;
  note?: string;
}

interface RefundRow {
  _id: string;
  orderId: string;
  customerId: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  reason: string;
  adminNote?: string;
  rejectionReason?: string;
  bookingType?: string;
  orderStatus?: string;
  customerName?: string;
  customerAvatarUrl?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
}

interface RefundPaymentInfo {
  method: string;
  receiptCode?: string;
}

interface RefundCounts {
  pending: number;
  underReview: number;
  approved: number;
  total: number;
  rejected: number;
  processed: number;
  refundedAmount: number;
}

type RefundQueueState = 'nominal' | 'attention' | 'critical';
type StatusTab = 'all' | 'needs_review' | 'approved' | 'processed' | 'rejected' | 'closed';

const refundCopy: StatusPillCopy<RefundQueueState> = {
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
    detail: 'High volume of open requests — prioritize oldest first.',
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

function needsReview(r: RefundRow) {
  return r.status === 'pending' || r.status === 'under_review' || r.status === 'verified';
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Small blocks ───────────────────────────────────────────────────────────
function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `rounded-lg p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function Avatar({ name, avatarUrl, size = 32 }: { name?: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name ?? 'Customer'}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function RefundsBoard() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<{ items: RefundRow[]; counts: RefundCounts }>('/admin/refunds');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const counts = useMemo(
    () =>
      data?.counts ?? {
        pending: 0,
        underReview: 0,
        approved: 0,
        total: 0,
        rejected: 0,
        processed: 0,
        refundedAmount: 0,
      },
    [data?.counts],
  );
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const tabFiltered = useMemo(() => {
    if (statusTab === 'needs_review') return items.filter(needsReview);
    if (statusTab === 'approved') return items.filter((r) => r.status === 'approved');
    if (statusTab === 'processed') return items.filter((r) => r.status === 'processed');
    if (statusTab === 'rejected') return items.filter((r) => r.status === 'rejected');
    if (statusTab === 'closed') return items.filter((r) => r.status === 'closed');
    return items;
  }, [items, statusTab]);

  const dateFiltered = useMemo(() => {
    if (!dateFrom && !dateTo) return tabFiltered;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity;
    return tabFiltered.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t >= from && t <= to;
    });
  }, [tabFiltered, dateFrom, dateTo]);

  const reasonFiltered = useMemo(
    () => (reasonFilter ? dateFiltered.filter((r) => r.reason === reasonFilter) : dateFiltered),
    [dateFiltered, reasonFilter],
  );

  const reasonOptions = useMemo(() => {
    const distinct = [...new Set(items.map((r) => r.reason).filter(Boolean))].sort();
    return [{ value: '', label: 'All reasons' }, ...distinct.map((r) => ({ value: r, label: r }))];
  }, [items]);

  const searchedItems = useMemo(() => {
    return filterBySearch(reasonFiltered, search, [
      (r) => r.orderId,
      (r) => r.reason,
      (r) => r.status,
      (r) => r.customerName,
      (r) => r.bookingType,
    ]);
  }, [reasonFiltered, search]);

  const totalPages = Math.max(1, Math.ceil(searchedItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const filteredItems = useMemo(
    () => searchedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [searchedItems, currentPage, pageSize],
  );

  const selected = useMemo(
    () => (selectedId ? (items.find((r) => r._id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const loadPaymentInfo = useCallback(async (): Promise<RefundPaymentInfo | null> => {
    if (!selected) return null;
    const res = await adminFetch<{ payment: { method: string; receiptCode?: string } | null }>(
      `/admin/refunds/${selected._id}`,
    );
    return res.payment ? { method: res.payment.method, receiptCode: res.payment.receiptCode } : null;
  }, [selected]);
  const { data: paymentInfo, loading: paymentInfoLoading } = useAdminQuery(loadPaymentInfo, [selected?._id]);

  const queueValue = useMemo(
    () =>
      items
        .filter((r) => r.status === 'pending' || r.status === 'under_review')
        .reduce((s, r) => s + r.requestedAmount, 0),
    [items],
  );

  const decided = counts.processed + counts.rejected;
  const successRate = decided > 0 ? Math.round((counts.processed / decided) * 1000) / 10 : null;

  const queueState = deriveRefundState(counts);
  const copy = refundCopy[queueState];
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  // Tab badges use the server-computed, uncapped counts (same source as the stat tiles above)
  // wherever available, rather than re-deriving from `items` — the list endpoint caps `items`
  // to the 100 most-recently-updated refunds, so a client-side count would silently disagree
  // with the accurate "Total refunds"/"Needs review" stat tiles once total volume exceeds 100.
  // "Closed" has no server-side count field yet, so it's still derived from the capped window.
  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All refunds', count: counts.total },
    { id: 'needs_review', label: 'Needs review', count: counts.pending + counts.underReview },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'processed', label: 'Processed', count: counts.processed },
    { id: 'rejected', label: 'Rejected', count: counts.rejected },
    { id: 'closed', label: 'Closed', count: items.filter((r) => r.status === 'closed').length },
  ];

  function selectTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedId(null);
    setPage(1);
  }

  function changeReasonFilter(value: string) {
    setReasonFilter(value);
    setPage(1);
  }

  function changeDateFrom(value: string) {
    setDateFrom(value);
    setPage(1);
  }

  function changeDateTo(value: string) {
    setDateTo(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
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
            <span className="dc-sublabel tabular-nums" title="Last data refresh">Updated {updatedLabel}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}

      {loading && !data && (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Loading refunds…
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* ── Queue state banner ───────────────────────────────── */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {counts.pending > 0 && (
              <span className="badge-warning px-3 py-1 text-xs font-semibold">{counts.pending} pending</span>
            )}
            {counts.underReview > 0 && (
              <span className="badge-primary px-3 py-1 text-xs font-semibold">{counts.underReview} under review</span>
            )}
            {counts.approved > 0 && (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">{counts.approved} approved</span>
            )}
          </div>

          {/* ── Stat tiles ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Total refunds"
              value={counts.total.toLocaleString()}
              sub="all time"
              tone="primary"
              onClick={() => selectTab('all')}
              active={statusTab === 'all'}
            />
            <StatTile
              label="Refunded amount"
              value={formatPeso(counts.refundedAmount, true)}
              sub="processed to wallets"
              tone="accent"
            />
            <StatTile
              label="Needs review"
              value={(counts.pending + counts.underReview).toLocaleString()}
              sub="pending + in review"
              tone={counts.pending + counts.underReview > 0 ? 'amber' : 'secondary'}
              onClick={() => selectTab('needs_review')}
              active={statusTab === 'needs_review'}
            />
            <StatTile
              label="Queue value"
              value={formatPeso(queueValue, true)}
              sub="open requests"
              tone="violet"
            />
            <StatTile
              label="Processed"
              value={counts.processed.toLocaleString()}
              sub="refunds completed"
              tone="secondary"
              onClick={() => selectTab('processed')}
              active={statusTab === 'processed'}
            />
            <StatTile
              label="Approval rate"
              value={successRate != null ? `${successRate}%` : '—'}
              sub="processed vs rejected"
              tone={successRate != null && successRate < 50 ? 'rose' : 'accent'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Refund ledger ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Refund status"
              >
                <div className="flex min-w-max gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === t.id}
                      onClick={() => selectTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        statusTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 px-4 pt-3">
                <div>
                  <label htmlFor="refund-date-from" className="form-label">Requested from</label>
                  <input
                    id="refund-date-from"
                    type="date"
                    className="input-field"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => changeDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="refund-date-to" className="form-label">To</label>
                  <input
                    id="refund-date-to"
                    type="date"
                    className="input-field"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => changeDateTo(e.target.value)}
                  />
                </div>
                {dateFrom || dateTo ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setPage(1);
                    }}
                  >
                    Clear dates
                  </button>
                ) : null}
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={changeSearch}
                  searchPlaceholder="Order ID, customer, reason…"
                  limit={pageSize}
                  onLimitChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  limitOptions={[10, 25, 50, 100]}
                  total={tabFiltered.length}
                  filtered={searchedItems.length}
                  filterValue={reasonFilter}
                  onFilterChange={changeReasonFilter}
                  filterOptions={reasonOptions}
                  filterLabel="Reason"
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">
                    {search || statusTab !== 'all' ? 'No refunds match' : 'No refund requests'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusTab !== 'all'
                      ? 'Try another filter or search term.'
                      : 'Customers submit refund requests from their order history.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[820px]">
                    <caption className="sr-only">Refund request ledger</caption>
                    <thead>
                      <tr>
                        <th scope="col">Order / customer</th>
                        <th scope="col" className="text-right">Amount</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Status</th>
                        <th scope="col">Requested</th>
                        <th scope="col">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((r) => {
                        const isSelected = selectedId === r._id;
                        return (
                          <tr
                            key={r._id}
                            onClick={() => setSelectedId((prev) => (prev === r._id ? null : r._id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${
                              isSelected
                                ? 'bg-primary/5 hover:bg-primary/5'
                                : r.status === 'pending'
                                  ? 'bg-amber-50/40'
                                  : ''
                            }`}
                          >
                            <td>
                              <div className="flex items-center gap-2.5">
                                <Avatar name={r.customerName} avatarUrl={r.customerAvatarUrl} size={28} />
                                <div className="min-w-0">
                                  <p className="font-medium tabular-nums text-slate-900">{formatOrderId(r.orderId)}</p>
                                  <p className="max-w-[10rem] truncate text-xs text-muted">
                                    {r.customerName ?? 'Unknown customer'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-right font-medium tabular-nums">
                              {formatPeso(r.approvedAmount ?? r.requestedAmount)}
                            </td>
                            <td className="max-w-[13rem] truncate text-muted" title={r.reason}>{r.reason}</td>
                            <td><span className={statusBadgeClass(r.status)}>{formatRefundStatus(r.status)}</span></td>
                            <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                            <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.processedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {searchedItems.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
                  <p className="text-xs text-muted">
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, searchedItems.length)} of {searchedItems.length} refunds
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
                      )
                      .reduce<number[]>((acc, p) => {
                        if (acc.length > 0 && p - acc[acc.length - 1] > 1) acc.push(-1);
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === -1 ? (
                          <span key={`gap-${i}`} className="px-1 text-xs text-muted">…</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPage(p)}
                            className={
                              p === currentPage
                                ? 'flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white'
                                : 'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-muted hover:bg-slate-100'
                            }
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            {/* ── Detail rail ── */}
            <div className="xl:col-span-4">
              {!selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Refund detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select a refund row to preview it here.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={selected.customerName} avatarUrl={selected.customerAvatarUrl} size={36} />
                      <div className="min-w-0">
                        <span className={statusBadgeClass(selected.status)}>
                          {formatRefundStatus(selected.status)}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold tabular-nums text-slate-900">
                          {formatOrderId(selected.orderId)}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {selected.customerName ?? 'Unknown customer'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <RailSection title="Request">
                    <RailRow label="Requested" value={formatPeso(selected.requestedAmount)} />
                    {selected.approvedAmount != null ? (
                      <RailRow label="Approved" value={formatPeso(selected.approvedAmount)} />
                    ) : null}
                    <RailRow label="Service" value={selected.bookingType ? formatSlugLabel(selected.bookingType) : '—'} />
                    <RailRow label="Order status" value={selected.orderStatus ? formatSlugLabel(selected.orderStatus) : '—'} />
                    <RailRow label="Requested on" value={formatDateTime(selected.createdAt)} />
                    {selected.processedAt ? (
                      <RailRow label="Processed on" value={formatDateTime(selected.processedAt)} />
                    ) : null}
                  </RailSection>

                  <RailSection title="Payment">
                    {paymentInfoLoading ? (
                      <p className="text-xs text-muted">Loading payment details…</p>
                    ) : paymentInfo ? (
                      <>
                        <RailRow label="Method" value={<span className="uppercase">{paymentInfo.method}</span>} />
                        <RailRow label="Reference" value={paymentInfo.receiptCode ?? '—'} />
                      </>
                    ) : (
                      <p className="text-xs text-muted">No payment record found for this order.</p>
                    )}
                  </RailSection>

                  <RailSection title="Reason">
                    <p className="text-sm leading-relaxed text-slate-700">{selected.reason}</p>
                    {selected.rejectionReason ? (
                      <p className="text-sm leading-relaxed text-red-700">
                        <span className="font-medium">Rejected:</span> {selected.rejectionReason}
                      </p>
                    ) : null}
                    {selected.adminNote ? (
                      <p className="text-sm leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-900">Admin note:</span> {selected.adminNote}
                      </p>
                    ) : null}
                  </RailSection>

                  {selected.timeline.length > 0 ? (
                    <RailSection title="Timeline">
                      <ol className="space-y-0">
                        {selected.timeline.map((entry, i) => (
                          <li key={`${entry.stage}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                            {i < selected.timeline.length - 1 ? (
                              <span
                                className="absolute left-[5px] top-4 h-full w-px bg-emerald-200"
                                aria-hidden
                              />
                            ) : null}
                            <span
                              className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100"
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900">{entry.label}</p>
                              <p className="text-xs text-muted">{formatDateTime(entry.at)}</p>
                              {entry.note ? (
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{entry.note}</p>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </RailSection>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                    <Link href={`/orders/${selected.orderId}`} className="btn-outline btn-sm flex-1 text-center">
                      View order
                    </Link>
                    <Link href={`/refunds/${selected._id}`} className="btn-primary btn-sm flex-1 text-center">
                      Review refund
                    </Link>
                    <a
                      href={`/refunds/${selected._id}?print=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline btn-sm w-full text-center"
                    >
                      Download receipt
                    </a>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
