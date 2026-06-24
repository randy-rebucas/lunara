'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  priority: string;
  type?: string;
  customerEmail?: string;
  updatedAt?: string;
}

interface TicketCounts {
  open: number;
  inProgress: number;
  resolved: number;
  lostItem?: number;
}

type SupportState = 'nominal' | 'attention' | 'critical';

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/orders', label: 'Orders' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/revenue', label: 'Revenue' },
] as const;

const supportCopy: Record<
  SupportState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Support queue clear',
    detail: 'No open tickets waiting for admin response.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Tickets need review',
    detail: 'Open or in-progress tickets are waiting in the queue.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Support backlog elevated',
    detail: 'High volume of open tickets or urgent priority items.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function deriveSupportState(counts: TicketCounts, highPriorityOpen: number): SupportState {
  if (counts.open >= 10 || highPriorityOpen >= 3) return 'critical';
  if (counts.open > 0 || counts.inProgress > 0) return 'attention';
  return 'nominal';
}

function priorityBadgeClass(priority: string) {
  if (priority === 'high') return 'badge-danger';
  if (priority === 'medium') return 'badge-warning';
  return 'badge-neutral';
}

function statusBadgeClass(status: string) {
  if (status === 'open') return 'badge-warning';
  if (status === 'in_progress') return 'badge-primary';
  if (status === 'resolved') return 'badge-accent';
  return 'badge-neutral';
}

function needsAttention(t: Ticket) {
  return (
    (t.status === 'open' || t.status === 'in_progress') &&
    (t.priority === 'high' || t.type === 'lost_item')
  );
}

function formatUpdated(at?: string) {
  if (!at) return '—';
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SupportBoard() {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (typeFilter) params.set('type', typeFilter);
    const q = params.toString() ? `?${params}` : '';
    const data = await adminFetch<{ items: Ticket[]; counts: TicketCounts }>(`/admin/tickets${q}`);
    setLastUpdated(new Date());
    return data;
  }, [filter, typeFilter]);

  const { data, loading, error, reload } = useAdminQuery(load, [filter, typeFilter]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const counts = data?.counts ?? { open: 0, inProgress: 0, resolved: 0, lostItem: 0 };
  const items = data?.items ?? [];

  const filteredItems = useMemo(() => {
    const searched = filterBySearch(items, search, [
      (t) => t.subject,
      (t) => t.customerEmail,
      (t) => t.status,
      (t) => t.type,
      (t) => t.priority,
    ]);
    return searched.slice(0, limit);
  }, [items, search, limit]);

  const highPriorityOpen = useMemo(
    () =>
      items.filter(
        (t) => t.priority === 'high' && (t.status === 'open' || t.status === 'in_progress'),
      ).length,
    [items],
  );

  const attentionTickets = useMemo(() => items.filter(needsAttention).slice(0, 12), [items]);

  const supportState = deriveSupportState(counts, highPriorityOpen);
  const copy = supportCopy[supportState];

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
            <p className="dc-eyebrow">Customer success</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Support
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Ticket queue — general inquiries and lost-item investigations with order evidence.
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
            <a href="#ticket-ledger" className="btn-primary btn-sm">
              Ticket queue
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
          Loading tickets…
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
            {counts.open > 0 ? (
              <a href="#ticket-attention" className="badge-warning px-3 py-1 text-xs font-semibold">
                {counts.open} open
              </a>
            ) : null}
            {highPriorityOpen > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">
                {highPriorityOpen} high priority
              </span>
            ) : null}
            {(counts.lostItem ?? 0) > 0 ? (
              <button
                type="button"
                className="badge-primary px-3 py-1 text-xs font-semibold"
                onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
              >
                {counts.lostItem} lost item{(counts.lostItem ?? 0) === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Open"
              value={counts.open}
              href="#ticket-attention"
              highlight={counts.open > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="In progress"
              value={counts.inProgress}
              highlight={counts.inProgress > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Resolved"
              value={counts.resolved}
              highlight={counts.resolved > 0 ? 'accent' : undefined}
            />
            <MetricCell
              label="Lost items"
              value={counts.lostItem ?? 0}
              highlight={(counts.lostItem ?? 0) > 0 ? 'danger' : undefined}
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

          {attentionTickets.length > 0 ? (
            <section className="dc-panel" id="ticket-attention">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Priority queue</h2>
                  <p className="text-xs text-muted">
                    High priority and lost-item tickets needing response
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[640px]">
                  <caption className="sr-only">Priority support tickets</caption>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Type</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionTickets.map((t) => (
                      <tr key={t._id}>
                        <td className="max-w-[14rem] truncate font-medium" title={t.subject}>
                          {t.subject}
                        </td>
                        <td className="text-muted">{t.customerEmail ?? '—'}</td>
                        <td>
                          {t.type === 'lost_item' ? (
                            <span className="badge-primary">Lost item</span>
                          ) : (
                            <span className="capitalize text-muted">
                              {t.type ? formatSlugLabel(t.type) : 'General'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`${priorityBadgeClass(t.priority)} capitalize`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`${statusBadgeClass(t.status)} capitalize`}>
                            {formatSlugLabel(t.status)}
                          </span>
                        </td>
                        <td>
                          <Link href={`/support/${t._id}`} className="link-primary text-xs font-medium">
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
                <h2 className="text-sm font-semibold text-slate-900">Queue filters</h2>
                <p className="text-xs text-muted">
                  {filter || typeFilter
                    ? 'Filtered ticket feed'
                    : `${items.length} tickets in current load`}
                </p>
              </div>
              {filter || typeFilter ? (
                <button
                  type="button"
                  className="link-primary text-xs font-medium"
                  onClick={() => {
                    setFilter('');
                    setTypeFilter('');
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="dc-panel-body pt-1">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
                <button
                  type="button"
                  onClick={() => setTypeFilter('')}
                  className={!typeFilter ? 'filter-chip-active' : 'filter-chip'}
                  aria-pressed={!typeFilter}
                >
                  All types
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
                  className={
                    typeFilter === 'lost_item'
                      ? 'filter-chip-active bg-amber-600 hover:bg-amber-600'
                      : 'filter-chip'
                  }
                  aria-pressed={typeFilter === 'lost_item'}
                >
                  Lost items ({counts.lostItem ?? 0})
                </button>
              </div>
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by status"
              >
                {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
                  <button
                    key={s || 'all'}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={`capitalize ${filter === s ? 'filter-chip-active' : 'filter-chip'}`}
                    aria-pressed={filter === s}
                  >
                    {s ? formatSlugLabel(s) : 'All statuses'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <ListControls
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Subject, customer, status…"
            limit={limit}
            onLimitChange={setLimit}
            total={items.length}
            filtered={filteredItems.length}
          />

          <section className="dc-panel" id="ticket-ledger">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Ticket ledger</h2>
                <p className="text-xs text-muted">
                  Showing {filteredItems.length} of {items.length} tickets
                </p>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="dc-panel-empty">
                <p className="font-medium text-slate-900">No tickets match</p>
                <p className="mt-1 text-sm text-muted">
                  {search || filter || typeFilter
                    ? 'Try another filter or search term.'
                    : 'The queue is empty — customers open tickets from the app.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[880px]">
                  <caption className="sr-only">Support ticket ledger</caption>
                  <thead>
                    <tr>
                      <th scope="col">Subject</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Type</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Updated</th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((t) => (
                      <tr
                        key={t._id}
                        className={
                          t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed'
                            ? 'bg-red-50/40'
                            : t.type === 'lost_item' && t.status === 'open'
                              ? 'bg-amber-50/40'
                              : ''
                        }
                      >
                        <td className="max-w-[16rem]">
                          <Link href={`/support/${t._id}`} className="link-primary font-medium">
                            {t.subject}
                          </Link>
                        </td>
                        <td className="max-w-[12rem] truncate text-muted" title={t.customerEmail}>
                          {t.customerEmail ?? '—'}
                        </td>
                        <td>
                          {t.type === 'lost_item' ? (
                            <span className="badge-primary">Lost item</span>
                          ) : (
                            <span className="capitalize text-muted">
                              {t.type ? formatSlugLabel(t.type) : 'General'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`${priorityBadgeClass(t.priority)} capitalize`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`${statusBadgeClass(t.status)} capitalize`}>
                            {formatSlugLabel(t.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-muted tabular-nums">
                          {formatUpdated(t.updatedAt)}
                        </td>
                        <td>
                          <Link href={`/support/${t._id}`} className="link-primary text-xs font-medium">
                            Open →
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
